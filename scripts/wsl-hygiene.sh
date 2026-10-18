#!/usr/bin/env bash
# Repo hygiene audit: secrets must be ignored and absent from the working tree index and all history.
cd ~/whistle-midnight
echo "== tracked files matching secret-ish names (expect none):"
git ls-files | grep -E '(^|/)(\.env($|\.)|\.whistle/|\.midnight-state|\.midnight-wallet-state|midnight-level-db|.*\.seed$|.*\.key$|.*secret.*)' | grep -v '^\.env\.example$' || echo "none"
echo "== .env.example tracked (should be the only env file):"; git ls-files | grep -E '^\.env'
echo "== ignored as expected:"
git check-ignore -v .env .whistle/admin.undeployed.json .midnight-state.json .midnight-wallet-state midnight-level-db 2>&1
echo "== history: any commit ever touching secret paths (expect none):"
git log --all --name-only --pretty=format: | grep -E '(^|/)(\.env$|\.whistle/|\.midnight-state|\.midnight-wallet-state|midnight-level-db)' | sort -u || true
echo "(end history paths)"
echo "== history: Blockfrost token or seed material in any blob (pattern, no value printed):"
git grep -I -l -E 'nightpreprod[A-Za-z0-9]{10,}' $(git rev-list --all) 2>/dev/null | head -3 || true
echo "(end token scan)"
echo "== branches:"; git branch -a
echo "== tracked file count:"; git ls-files | wc -l
