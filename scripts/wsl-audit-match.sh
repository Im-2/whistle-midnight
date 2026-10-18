#!/usr/bin/env bash
cd ~/whistle-midnight
for f in .whistle/cases/*/*/reports/*.json; do
  m=$(grep -ioE 'alice|bob|carol|member|persona' "$f" | head -3 | tr '\n' ' ')
  [ -n "$m" ] && echo "match in $(basename "$f" | cut -c1-12)...: [$m]  | outside ciphertext: $(sed 's/"ciphertext": "[^"]*"//' "$f" | grep -ciE 'alice|bob|carol|member|persona')"
done
echo done
