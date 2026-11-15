#!/usr/bin/env bash
# Gives a NEW marae its first administrator and its settings row (Step 7 of ClickUp 14yhc7kw7b2).
#
#   scripts/provision-first-admin.sh <marae-name> --email <person@example.com> --marae-title "Te Marae o ..."
#
# Before running: invite the person in the Supabase dashboard (Authentication > Users > Invite
# user) so their sign-in exists. A database trigger then gives them a 'community' profile; this
# script promotes that profile to trustee + admin and makes sure a settings row exists with the
# marae's own name (the table's built-in defaults belong to another marae and must never show).
# Refuses Opeke, Terere, Test and Iwi Hub. Safe to run twice. Never touches any other row.
set -u -o pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STATE_DIR="$SCRIPT_DIR/.provision-state"; REGISTRY="$SCRIPT_DIR/marae-registry.json"
TOKEN_FILE="$HOME/.supabase/access-token"; MGMT_API="https://api.supabase.com/v1"
fail() { echo "❌ $1"; exit 1; }

NAME=""; EMAIL=""; TITLE=""
while [ $# -gt 0 ]; do
  case "$1" in
    --email) EMAIL="${2:-}"; shift 2 ;;
    --marae-title) TITLE="${2:-}"; shift 2 ;;
    -*) fail "unknown flag $1" ;;
    *) NAME="$1"; shift ;;
  esac
done
[ -n "$NAME" ] && [ -n "$EMAIL" ] && [ -n "$TITLE" ] || fail "Usage: $0 <marae-name> --email <person@example.com> --marae-title \"Te Marae o ...\""
echo "$EMAIL" | grep -Eq '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' || fail "that does not look like an email address"
[ "${#TITLE}" -le 80 ] || fail "marae title is too long"
case "$TITLE" in *\;*|*\\*|*--*) fail "marae title must not contain ; \\ or --" ;; esac
[ -f "$TOKEN_FILE" ] || fail "run 'supabase login' first"

REF="$(python3 - "$STATE_DIR/$NAME.json" "$REGISTRY" "$NAME" <<'PY'
import json,os,sys
st,reg,n=sys.argv[1:4]
if os.path.exists(st):
    r=json.load(open(st)).get('ref')
    if r: print(r); sys.exit(0)
for p in json.load(open(reg))['projects']:
    if p['name']==n: print(p['ref']); sys.exit(0)
PY
)"
[ -n "$REF" ] || fail "no project ref for '$NAME'"
case "$REF" in cbeenk*|fwtxb*|zfefu*|autzr*) fail "$NAME is a live project. This script only sets up a new marae." ;; esac

q() { # run one SQL statement, print the JSON result
  python3 -c "import json,sys;print(json.dumps({'query':sys.argv[1]}))" "$1" > "$SCRATCH/b.json"
  curl -sS -X POST -H "Authorization: Bearer $(cat "$TOKEN_FILE")" -H "Content-Type: application/json" "$MGMT_API/projects/$REF/database/query" --data @"$SCRATCH/b.json"
}
SCRATCH="${TMPDIR:-/tmp}/provision-admin-$$"; mkdir -p "$SCRATCH"; chmod 700 "$SCRATCH"; trap 'rm -rf "$SCRATCH"' EXIT
SQE="${EMAIL//\'/\'\'}"; SQT="${TITLE//\'/\'\'}"

R="$(q "select count(*) as n from public.profiles where lower(email) = lower('$SQE');")"
echo "$R" | grep -q '"n":1' || fail "no sign-in found for that email on $NAME. Invite them first: Supabase dashboard > Authentication > Users > Invite user, then run this again."

R="$(q "insert into public.marae_settings (marae_name, location, onboarding_complete, onboarding_step) select '$SQT', null, false, 0 where not exists (select 1 from public.marae_settings);")"
echo "$R" | grep -q '"message"' && fail "could not create the settings row: $(echo "$R" | head -c 300)"
R="$(q "update public.profiles set role = 'trustee', trustee_role = 'admin' where lower(email) = lower('$SQE') returning role, trustee_role;")"
echo "$R" | grep -q '"trustee_role":"admin"' || fail "could not promote: $(echo "$R" | head -c 300)"
R="$(q "select marae_name, onboarding_complete from public.marae_settings limit 1;")"
echo "✅ first administrator set on $NAME; settings row: $R"
