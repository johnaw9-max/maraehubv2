#!/usr/bin/env bash
# Deletes a REHEARSAL Supabase project (one built by provision-marae.sh to test it).
# Refuses, with no override, if the project ref:
#   - starts with a protected prefix: cbeenk (Opeke), fwtxb (Terere), zfefu (test), autzr (Iwi Hub)
#   - appears in scripts/marae-registry.json
# Then shows the project name and needs you to type that name to continue.
# Deleting a project cannot be undone.
set -u -o pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REF="${1:-}"; TOKEN_FILE="$HOME/.supabase/access-token"
fail() { echo "❌ $1"; exit 1; }
[ -n "$REF" ] || fail "Usage: $0 <project-ref>"
echo "$REF" | grep -Eq '^[a-z]{20}$' || fail "that does not look like a project ref"
case "$REF" in cbeenk*|fwtxb*|zfefu*|autzr*) fail "$REF is a protected live project (Opeke, Terere, test or Iwi Hub). Refusing. No override exists." ;; esac
grep -q "$REF" "$SCRIPT_DIR/marae-registry.json" && fail "$REF is in the registry. Refusing. No override exists."
[ -f "$TOKEN_FILE" ] || fail "run 'supabase login' first"
TOKEN="$(cat "$TOKEN_FILE")"
INFO="$(curl -sS -H "Authorization: Bearer $TOKEN" "https://api.supabase.com/v1/projects/$REF")"
PNAME="$(echo "$INFO" | python3 -c "import json,sys;print(json.load(sys.stdin).get('name',''))" 2>/dev/null)"
[ -n "$PNAME" ] || fail "project not found"
case "$PNAME" in maraehub-*) ;; *) fail "'$PNAME' is not named maraehub-*, so it is not a rehearsal project built by provision-marae.sh. Refusing." ;; esac
echo "About to PERMANENTLY delete project '$PNAME' ($REF). This cannot be undone."
printf "Type the project name to confirm: "; read -r ANSWER < /dev/tty
[ "$ANSWER" = "$PNAME" ] || fail "name did not match; nothing deleted"
curl -sS -X DELETE -H "Authorization: Bearer $TOKEN" "https://api.supabase.com/v1/projects/$REF" >/dev/null && echo "✅ deleted $PNAME"
rm -f "$SCRIPT_DIR/.provision-state/"*.json.deleted 2>/dev/null
