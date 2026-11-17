#!/usr/bin/env bash
# Copies the FILES in a marae's storage buckets from one Supabase project to another
# (the rows are copied by scripts/copy-marae-data.js). Built for the Opeke move to Sydney
# (ClickUp 14yhc7kw7b2).
#
#   scripts/copy-marae-files.sh <from-name> <to-name>
#
# Names are the names in scripts/marae-registry.json. Every file is copied by its exact name and
# file type (taken from the source's own list), never by folder, so names cannot drift. Flow:
# download each file into a scratch folder, check the count, remove files in the target that are
# not in the source's list (leftovers of an earlier attempt), upload each file with its file type,
# then run copy-marae-data.js --verify-only, which compares file names, sizes and types.
#
# Safety rules (no override flags):
#   - the source is only read
#   - the target can never be a protected live project (cbeenk, fwtxb, zfefu, autzr) and must be
#     named maraehub-*; files are only ever removed from the target
#   - nothing is uploaded or removed unless the download matched the source's list exactly
#   - downloaded files sit in a scratch folder only you can open and are deleted when this ends
#   - works in its own scratch folder: it never touches the repo folder or its Supabase link
#   - safe to run twice
set -u -o pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REGISTRY="${MARAEHUB_REGISTRY:-$SCRIPT_DIR/marae-registry.json}"
TOKEN_FILE="$HOME/.supabase/access-token"
API="${MARAEHUB_MGMT_API:-https://api.supabase.com/v1}"
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

# list the files a project holds, as NUL-separated records: bucket, name, file type (plain select)
list_files() {  # $1 = project ref, $2 = output file
  python3 -c "import json;print(json.dumps({'query':\"select bucket_id, name, coalesce(metadata->>'mimetype','application/octet-stream') as mime from storage.objects order by 1,2\"}))" > "$SCRATCH/q.json"
  curl -sS -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" --data @"$SCRATCH/q.json" "$API/projects/$1/database/query" \
    | python3 -c "
import json,sys
d=json.load(sys.stdin)
if not isinstance(d,list): sys.stderr.write('ERR '+str(d.get('message',''))); sys.exit(1)
sys.stdout.write(''.join(r['bucket_id']+'\0'+r['name']+'\0'+r['mime']+'\0' for r in d))" > "$2"
}
list_files "$SRC" "$SCRATCH/source.list" || fail "could not read the source's file list"
TOTAL="$(tr -cd '\0' < "$SCRATCH/source.list" | wc -c | tr -d ' ')"; TOTAL=$((TOTAL / 3))
[ "$TOTAL" -gt 0 ] || { echo "Source holds no files. Nothing to copy."; exit 0; }
echo "Source holds ${TOTAL} files."

cd "$SCRATCH/proj" || fail "scratch folder"
npx --yes supabase init >/dev/null 2>&1 || fail "could not set up the scratch Supabase folder"
st() { npx supabase --experimental storage "$@" 2>&1 < /dev/null; }  # </dev/null: stops npx eating the file list the loops read

echo "1/4 Downloading from ${FROM}…"
LINK_OUT="$(npx supabase link --project-ref "$SRC" 2>&1)" || fail "could not link to the source ($(echo "$LINK_OUT" | tail -2 | tr '\n' ' '))"
N=0
while IFS= read -r -d '' B && IFS= read -r -d '' NAME && IFS= read -r -d '' M; do
  mkdir -p "$(dirname "$SCRATCH/files/$B/$NAME")"
  OUT="$(st cp "ss:///$B/$NAME" "$SCRATCH/files/$B/$NAME")" || fail "download failed for a file in bucket $B: $(echo "$OUT" | tail -2 | tr '\n' ' ')"
  [ -f "$SCRATCH/files/$B/$NAME" ] || fail "download of a file in bucket $B did not produce the expected file. Nothing was uploaded."
  N=$((N + 1))
done < "$SCRATCH/source.list"
[ "$N" = "$TOTAL" ] || fail "downloaded $N of $TOTAL files. Nothing was uploaded."
echo "  ${N} files downloaded"

echo "2/4 Clearing leftovers in ${TO} (files not in the source's list)…"
LINK_OUT="$(npx supabase link --project-ref "$DST" 2>&1)" || fail "could not link to the target ($(echo "$LINK_OUT" | tail -2 | tr '\n' ' '))"
list_files "$DST" "$SCRATCH/target.list" || fail "could not read the target's file list"
python3 - "$SCRATCH/source.list" "$SCRATCH/target.list" "$SCRATCH/remove.list" <<'PY'
import sys
def recs(p):
    parts = open(p,'rb').read().decode('utf-8').split('\0')[:-1]
    return [(parts[i],parts[i+1]) for i in range(0,len(parts),3)]
keep=set(recs(sys.argv[1]))
out=''.join(b+'\0'+n+'\0' for b,n in recs(sys.argv[2]) if (b,n) not in keep)
open(sys.argv[3],'w',encoding='utf-8').write(out)
PY
R=0
while IFS= read -r -d '' B && IFS= read -r -d '' NAME; do
  OUT="$(st rm --yes "ss:///$B/$NAME")" || fail "could not remove a leftover file in bucket $B: $(echo "$OUT" | tail -2 | tr '\n' ' ')"
  R=$((R + 1))
done < "$SCRATCH/remove.list"
list_files "$DST" "$SCRATCH/target2.list" || fail "could not re-read the target's file list"
python3 - "$SCRATCH/source.list" "$SCRATCH/target2.list" <<'PY' || fail "leftover files are still in the target after removal. Nothing was uploaded."
import sys
def recs(p):
    parts = open(p,'rb').read().decode('utf-8').split('\0')[:-1]
    return [(parts[i],parts[i+1]) for i in range(0,len(parts),3)]
keep=set(recs(sys.argv[1]))
left=[r for r in recs(sys.argv[2]) if r not in keep]
sys.exit(1 if left else 0)
PY
echo "  ${R} leftover files removed (checked: none remain)"

echo "3/4 Uploading to ${TO}…"
U=0
while IFS= read -r -d '' B && IFS= read -r -d '' NAME && IFS= read -r -d '' M; do
  OUT="$(st cp --content-type "$M" "$SCRATCH/files/$B/$NAME" "ss:///$B/$NAME")" || fail "upload failed for a file in bucket $B: $(echo "$OUT" | tail -2 | tr '\n' ' ')"
  U=$((U + 1))
done < "$SCRATCH/source.list"
echo "  ${U} files uploaded"

echo "4/4 Checking names, sizes and file types against the source…"
node "$SCRIPT_DIR/copy-marae-data.js" --from "$FROM" --to "$TO" --verify-only
