#!/usr/bin/env bash
# Audits the public static build for anything that must never be published.
cd ~/whistle-midnight
D=web/dist-public
echo "== files in $D (expect: index.html, vercel.json, assets/, img/ only):"
find $D -type f | sed "s#^$D/##" | grep -vE '^assets/.*\.(woff2?|js|css)$|^img/.*\.webp$'
echo "== unexpected file types (maps, env, json other than vercel.json, keys):"
find $D -type f \( -name '*.map' -o -name '.env*' -o -name '*.key' -o -name '*.pem' -o -name '*.seed' \) | wc -l
find $D -type f -name '*.json' ! -name 'vercel.json' | wc -l
echo "== forbidden strings in the built output (each should be 0):"
for pat in '/api/' 'localhost' '127\.0\.0\.1' '8787' 'project_id' 'nightpreprod' 'blockfrost' 'BLOCKFROST' 'mnemonic' 'seed' 'privateKey' 'private\.json' '\.whistle' 'adminSecret' 'memberSecret' 'x-access-token' 'gho_' 'ghp_' 'github_pat' 'mn_addr_' 'VERCEL_TOKEN' 'midnight-level-db' '\.midnight-state'; do
  n=$(grep -rIoE "$pat" $D 2>/dev/null | wc -l)
  printf '%-22s %s\n' "$pat" "$n"
done
echo "== any 64-hex string (contract addresses, keys, hashes): $(grep -rIoE '[0-9a-fA-F]{64}' $D | wc -l)"
echo "== long base64-like runs (>=60 chars) in JS/HTML (possible embedded keys): $(grep -rIoE '[A-Za-z0-9+/]{60,}={0,2}' $D --include=*.js --include=*.html | wc -l)"
echo "== the word secret/key appears only as prose? (count of lines, for context):"
grep -rIoE '.{30}secret.{30}' $D --include=*.js | head -4
echo "== tracked in git (expect none):"
git ls-files | grep -E '(^|/)(\.env$|\.whistle/|private\.json|\.midnight-wallet-state|midnight-level-db|\.vercel/|dist-public/)' | wc -l
echo "== env files present on disk but must be untracked:"
git check-ignore -v .env .whistle web/dist-public .vercel 2>&1 | cut -c1-80
echo "== tracked env example (should be the only env file):"
git ls-files | grep -E '^\.env'
