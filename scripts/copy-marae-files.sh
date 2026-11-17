#!/usr/bin/env bash
# Copies the FILES in a marae's storage buckets from one Supabase project to another
# (the rows are copied by scripts/copy-marae-data.js). Built for the Opeke move to Sydney
# (ClickUp 14yhc7kw7b2).
#
#   scripts/copy-marae-files.sh <from-name> <to-name>
#
# Names are the names in scripts/marae-registry.json. Flow: download every file from the source
# into a scratch folder, check the count against the source's own list, upload to the target,
# then run copy-marae-data.js --verify-only, which compares file names and sizes.
#
# Safety rules (no override flags):
#   - the source is only read
#   - the target can never be a protected live project (cbeenk, fwtxb, zfefu, autzr) and must be
#     named maraehub-*
#   - nothing is uploaded unless the download matched the source's list exactly
#   - downloaded files sit in a scratch folder only you can open and are deleted when this ends
#   - works in its own scratch folder: it never touches the repo folder or its Supabase link
#   - safe to run twice: files that already exist are overwritten with the same content
set -u -o pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REGISTRY="${MARAEHUB_REGISTRY:-$SCRIPT_DIR/marae-registry.json}"
TOKEN_FILE="$HOME/.supabase/access-token"
API="https://api.supabase.com/v1"
fail() { echo "❌ $1"; exit 1; }

FROM="${1:-}"; TO="${2:-}"
[ -n "$FROM" ] && [ -n "$TO" ] || fail "Usage: $0 <from-name> <to-name>"
[ "$FROM" != "$TO" ] || fail "from and to are the same project. Refusing."
[ -f "$TOKEN_FILE" ] || fail "run 'supabase login' first ($TOKEN_FILE not found)"
TOKEN="$(cat "$TOKEN_FILE")"
export SUPABASE_ACCESS_TOKEN="$TOKEN"

ref_of() { python3 - "$REGISTRY" "$1" <<'PY'
import json,sys
for p in json.load(open(sys.argv[1]))['projects']:
    if p['name']==sys.argv[2]: print(p['ref']); break
PY
}
SRC="$(ref_of "$FROM")"; DST="$(ref_of "$TO")"
[ -n "$SRC" ] || fail "'$FROM' is not in the registry"
[ -n "$DST" ] || fail "'$TO' is not in the registry"
case "$DST" in cbeenk*|fwtxb*|zfefu*|autzr*) fail "$DST is a protected live project. It can never be a target. No override exists." ;; esac
DNAME="$(curl -sS -H "Authorization: Bearer $TOKEN" "$API/projects/$DST" | python3 -c "import json,sys;print(json.load(sys.stdin).get('name',''))" 2>/dev/null)"
case "$DNAME" in maraehub-*) ;; *) fail "target '$DNAME' is not named maraehub-*. Refusing." ;; esac

SCRATCH="$(mktemp -d "${TMPDIR:-/tmp}/copy-marae-files.XXXXXX")" || fail "cannot make a scratch folder"
chmod 700 "$SCRATCH"
trap 'rm -rf "$SCRATCH"' EXIT
mkdir -p "$SCRATCH/proj" "$SCRATCH/files"

# what the source says it holds: bucket<TAB>count (a plain select, nothing is changed)
LIST_SQL="select bucket_id || E'\\t' || count(*) as line from storage.objects group by bucket_id order by bucket_id"
python3 -c "import json,sys;print(json.dumps({'query':sys.argv[1]}))" "$LIST_SQL" > "$SCRATCH/q.json"
LIST="$(curl -sS -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" --data @"$SCRATCH/q.json" "$API/projects/$SRC/database/query" \
  | python3 -c "import json,sys;d=json.load(sys.stdin);print('\n'.join(r['line'] for r in d) if isinstance(d,list) else 'ERR '+str(d.get('message','')))")"
case "$LIST" in ERR*) fail "could not read the source's file list: $LIST" ;; esac
[ -n "$LIST" ] || { echo "Source holds no files. Nothing to copy."; exit 0; }
echo "Source holds files in these buckets (name, count):"; echo "$LIST" | sed 's/^/  /'

cd "$SCRATCH/proj" || fail "scratch folder"
npx --yes supabase init >/dev/null 2>&1 || fail "could not set up the scratch Supabase folder"

echo "1/3 Downloading from $FROM…"
LINK_OUT="$(npx supabase link --project-ref "$SRC" 2>&1)" || fail "could not link to the source ($(echo "$LINK_OUT" | tail -2 | tr '\n' ' '))"
echo "$LIST" | while IFS="$(printf '\t')" read -r B N; do
  mkdir -p "$SCRATCH/files/$B"
  OUT="$(npx supabase --experimental storage cp -r "ss:///$B" "$SCRATCH/files/$B" 2>&1)" || { echo "❌ download of bucket $B failed: $(echo "$OUT" | tail -2 | tr '\n' ' ')"; exit 1; }
  GOT="$(find "$SCRATCH/files/$B" -type f | wc -l | tr -d ' ')"
  [ "$GOT" = "$N" ] || { echo "❌ bucket $B: source lists $N files but $GOT were downloaded. Nothing was uploaded."; exit 1; }
  echo "  $B: $GOT files"
done || exit 1

echo "2/3 Uploading to $TO…"
LINK_OUT="$(npx supabase link --project-ref "$DST" 2>&1)" || fail "could not link to the target ($(echo "$LINK_OUT" | tail -2 | tr '\n' ' '))"
echo "$LIST" | while IFS="$(printf '\t')" read -r B N; do
  OUT="$(npx supabase --experimental storage cp -r "$SCRATCH/files/$B" "ss:///$B" 2>&1)" || { echo "❌ upload of bucket $B failed: $(echo "$OUT" | tail -2 | tr '\n' ' ')"; exit 1; }
  echo "  $B: uploaded"
done || exit 1

echo "3/3 Checking names and sizes against the source…"
node "$SCRIPT_DIR/copy-marae-data.js" --from "$FROM" --to "$TO" --verify-only
