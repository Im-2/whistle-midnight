#!/usr/bin/env bash
# Audits the local report store: no plaintext, no sender information.
cd ~/whistle-midnight
echo "plaintext marker (ZEBRA) in any file under .whistle: $(grep -rl ZEBRA .whistle 2>/dev/null | wc -l)"
echo "sender words (alice|bob|carol|member|persona) in stored reports: $(grep -rilE 'alice|bob|carol|member|persona' .whistle/cases/*/*/reports 2>/dev/null | wc -l)"
echo "--- one stored report (ciphertext elided):"
f=$(ls .whistle/cases/*/*/reports/*.json | head -1)
sed 's/"ciphertext": "[^"]*"/"ciphertext": "<base64 ciphertext>"/' "$f"
echo "--- file modes of private keys:"
stat -c '%a' .whistle/cases/*/*/private.json
