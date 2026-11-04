#!/bin/sh
# Chrome native messaging host for the extension (extension/): opens the URL
# the extension sends in Safari with `open -a Safari`. Handing it over through
# Safari's x-safari-https scheme instead makes Safari show its "make Safari your
# default browser" banner on every handoff, and turns http into https.
#
# Shell rather than Elixir: Chrome starts it once per handoff with a bare PATH,
# where an Elixir VM would add a start-up delay and need mise to be found.
# Installed and registered with Chrome by `mise run install:host`.
#
# Protocol: a 4-byte native-endian length, then that many bytes of JSON
# ({"url": "..."}); the reply is framed the same way.
set -eu

reply() {
  # The replies are under 256 bytes, so the length is one byte and three zeros.
  printf "$(printf '\\%03o' "${#1}")\\000\\000\\000%s" "$1"
}

# dd with bs=1 reads exactly what it is asked for, so nothing past the message
# is consumed.
len=$(dd bs=1 count=4 2>/dev/null | od -An -tu4 | tr -d ' ')
url=$(dd bs=1 count="$len" 2>/dev/null | plutil -extract url raw -o - -)

case "$url" in
http://* | https://*)
  open -a Safari "$url"
  reply '{"ok":true}'
  ;;
*)
  reply '{"ok":false,"error":"not an http or https URL"}'
  ;;
esac
