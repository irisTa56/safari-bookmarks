#!/usr/bin/env elixir

# Export Safari's bookmarks as JSON for the extension (extension/), so Chrome
# can browse them read-only without a two-way sync that would race iCloud and
# Google Sync.
#
# Usage:
#   scripts/export_bookmarks.exs [OUT]
#
# OUT defaults to extension/bookmarks.json, rewritten on every run. A daemon
# outside this repository runs it at start and on each change to
# Bookmarks.plist (README.md "Running"), so an edit here shows on the next of
# those runs, or on a manual one.
# Only Safari's top-level lists are exported (Favorites, Bookmarks Menu and the
# folders made beside them), with everything inside them: a bookmark placed at
# the root of Bookmarks, outside all of them, and an empty list are left out.
# Reading ~/Library/Safari needs Full Disk Access for the process that runs this.

defmodule ExportBookmarks do
  @plist Path.expand("~/Library/Safari/Bookmarks.plist")
  @default_out Path.join(__DIR__, "../extension/bookmarks.json") |> Path.expand()

  # Safari's own names for its top-level lists, shown as the Safari UI shows them.
  @titles %{
    "BookmarksBar" => "Favorites",
    "BookmarksMenu" => "Bookmarks Menu"
  }

  # The Reading List is a queue to read through, not bookmarks to come back to.
  @skipped ["com.apple.ReadingList"]

  def main([]), do: export(@default_out)
  def main([out]), do: export(Path.expand(out))
  def main(_), do: fail("usage: export_bookmarks.exs [OUT]")

  defp export(out) do
    sections =
      read_plist()
      |> Map.get("Children", [])
      |> Enum.filter(&(&1["WebBookmarkType"] == "WebBookmarkTypeList"))
      |> Enum.reject(&(&1["Title"] in @skipped or (&1["Children"] || []) == []))
      |> Enum.map(&%{entry(&1) | title: Map.get(@titles, &1["Title"], &1["Title"])})

    generated = NaiveDateTime.local_now() |> NaiveDateTime.truncate(:second)

    File.mkdir_p!(Path.dirname(out))
    # Write beside the target and rename, so the panel never reads half a file.
    tmp = out <> ".tmp"
    File.write!(tmp, JSON.encode!(%{generated: generated, sections: sections}))
    File.rename!(tmp, out)
    IO.puts("wrote #{out}")
  end

  # A folder is {title, children}, a bookmark {title, url}; anything else
  # (Safari's History proxy) is dropped.
  defp entry(%{"WebBookmarkType" => "WebBookmarkTypeList"} = list) do
    children = (list["Children"] || []) |> Enum.map(&entry/1) |> Enum.reject(&is_nil/1)
    %{title: list["Title"], children: children}
  end

  defp entry(%{"WebBookmarkType" => "WebBookmarkTypeLeaf", "URLString" => url} = leaf),
    do: %{title: get_in(leaf, ["URIDictionary", "title"]) || url, url: url}

  defp entry(_), do: nil

  # plutil turns the binary plist into XML that xmerl can read. The <data>
  # blobs (iCloud sync records) make up most of the file and are never shown,
  # so they are dropped before parsing.
  defp read_plist do
    case System.cmd("plutil", ["-convert", "xml1", "-o", "-", @plist], stderr_to_stdout: true) do
      {xml, 0} ->
        xml = Regex.replace(~r{<data>.*?</data>}s, xml, "<data/>")
        # xmerl decodes the UTF-8 itself, so it takes bytes rather than code points.
        {doc, _} = :xmerl_scan.string(:binary.bin_to_list(xml), quiet: true)
        [top] = elements(doc)
        decode(top)

      {err, _} ->
        fail("cannot read #{@plist}: #{String.trim(err)}")
    end
  end

  defp elements({:xmlElement, _, _, _, _, _, _, _, content, _, _, _}),
    do: Enum.filter(content, &match?({:xmlElement, _, _, _, _, _, _, _, _, _, _, _}, &1))

  defp text({:xmlElement, _, _, _, _, _, _, _, content, _, _, _}) do
    content
    |> Enum.map(fn
      {:xmlText, _, _, _, value, _} -> List.to_string(value)
      _ -> ""
    end)
    |> Enum.join()
  end

  defp decode({:xmlElement, name, _, _, _, _, _, _, _, _, _, _} = el) do
    case name do
      :dict ->
        el
        |> elements()
        |> Enum.chunk_every(2)
        |> Map.new(fn [k, v] -> {text(k), decode(v)} end)

      :array ->
        el |> elements() |> Enum.map(&decode/1)

      :string ->
        text(el)

      _ ->
        nil
    end
  end

  defp fail(message) do
    IO.puts(:stderr, message)
    System.halt(1)
  end
end

ExportBookmarks.main(System.argv())
