#!/bin/sh
# Chrome native messaging host for the extension (extension/). It answers two
# messages:
#   {"url": "..."}         opens the URL in Safari with `open -a Safari`.
#                          Handing it over through Safari's x-safari-https
#                          scheme instead makes Safari show its "make Safari
#                          your default browser" banner on every handoff, and
#                          turns http into https.
#   {"cmd": "bookmarks"}   replies with the export the side panel lists, as
#                          {"ok": true, "bookmarks": <bookmarks.json>}.
#
# Shell rather than Node: Chrome starts it once per message with a bare PATH,
# where mise's Node would have to be found first.
# Registered with Chrome by `mise run install`.
#
# Protocol: a 4-byte native-endian length, then that many bytes of JSON; the
# reply is framed the same way, and Chrome takes at most 1 MB from a host.
set -eu
# Byte lengths: ${#var} counts characters in a UTF-8 locale.
export LC_ALL=C

dir="$HOME/Library/Application Support/safari-bookmarks"

# The length as four little-endian bytes (macOS on Apple silicon and Intel
# alike), each written as an octal escape for printf.
length() {
  n=$1
  # The format is the escapes themselves, so it is built in a variable.
  # shellcheck disable=SC2059
  printf "$(printf '\\%03o\\%03o\\%03o\\%03o' $((n & 255)) $((n >> 8 & 255)) $((n >> 16 & 255)) $((n >> 24 & 255)))"
}

reply() {
  length "${#1}"
  printf %s "$1"
}

# dd with bs=1 reads exactly what it is asked for, so nothing past the message
# is consumed.
len=$(dd bs=1 count=4 2>/dev/null | od -An -tu4 | tr -d ' ')
msg=$(dd bs=1 count="$len" 2>/dev/null)
# plutil reads JSON too, and fails on a key the message lacks.
field() { printf %s "$msg" | plutil -extract "$1" raw -o - - 2>/dev/null || true; }

if [ "$(field cmd)" = bookmarks ]; then
  file="$dir/bookmarks.json"
  if [ ! -f "$file" ]; then
    reply '{"ok":false,"error":"no export yet; is the safari-bookmarks daemon running?"}'
    exit 0
  fi
  # Read once, so the length sent is that of the bytes sent even if the
  # exporter replaces the file meanwhile.
  body="{\"ok\":true,\"bookmarks\":$(cat "$file")}"
  if [ ${#body} -gt 1048576 ]; then
    reply '{"ok":false,"error":"the export is over the 1 MB a host may send Chrome"}'
    exit 0
  fi
  reply "$body"
  exit 0
fi

url=$(field url)
case "$url" in
http://* | https://*)
  open -a Safari "$url"
  reply '{"ok":true}'
  ;;
*)
  reply '{"ok":false,"error":"not an http or https URL"}'
  ;;
esac
