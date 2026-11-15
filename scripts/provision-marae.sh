#!/usr/bin/env bash
# Builds a brand-new marae Supabase project in one repeatable step (Step 2 of
# ClickUp 14yhc7kw7b2). Safe to run twice: progress is kept in a local state
# file (project ref only, never a secret) and finished phases are skipped.
#
#   scripts/provision-marae.sh <marae-name> [--region ap-southeast-2] [--dry-run]
#
# Phases: 1 create project (Sydney, Micro)  2 wait until healthy
#         3 apply baseline.sql (structure)  4 replay shared seed + later migrations
#         5 deploy edge functions           6 print what is still manual
#
# NOT in this script (later steps): secrets from a manifest (Step 3), scheduled
# jobs (Step 4), Vercel project (Step 5), registry entry (done by pull request
# after Step 5, so the live deploy tools never see a half-built marae).
#
# Rules, same as the other deploy scripts: refuses from a dirty folder, any
# branch but main, or an unpushed HEAD. No override flag. The database password
# is generated here, held in a 0600 scratch file only, and never printed or
# stored: reset it in the Supabase dashboard if it is ever needed. The access
# token is read from ~/.supabase/access-token and never printed.
# Marae-specific data is never copied between marae: nothing here reads a row.
set -u -o pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$SCRIPT_DIR/.."
REGISTRY_FILE="$SCRIPT_DIR/marae-registry.json"
STATE_DIR="$SCRIPT_DIR/.provision-state"
BASELINE_DIR="$REPO_DIR/supabase/baseline"
MIGRATIONS_DIR="$REPO_DIR/supabase/migrations"
ACCESS_TOKEN_FILE="$HOME/.supabase/access-token"
MGMT_API="https://api.supabase.com/v1"
ORG_ID="${MARAEHUB_SUPABASE_ORG:-ipvytiephdqqzivjmyfb}"
SCRATCH_DIR="${TMPDIR:-/tmp}/provision-marae-$$"

fail() { echo "❌ $1"; exit 1; }

NAME=""; REGION="ap-southeast-2"; DRY=0
while [ $# -gt 0 ]; do
  case "$1" in
    --region) REGION="${2:-}"; shift 2 ;;
    --dry-run) DRY=1; shift ;;
    -*) fail "unknown flag $1" ;;
    *) NAME="$1"; shift ;;
  esac
done
[ -n "$NAME" ] || fail "Usage: $0 <marae-name> [--region ap-southeast-2] [--dry-run]"
echo "$NAME" | grep -Eq '^[a-z][a-z0-9-]{1,30}$' || fail "marae-name must be lowercase letters, digits and dashes (2-31 chars)"
case "$REGION" in ap-southeast-2) ;; *) fail "region '$REGION' not allowed: new marae go in Sydney (ap-southeast-2), per the 15 Nov hosting decision" ;; esac

cd "$REPO_DIR" || fail "cannot cd to repo root"
[ -z "$(git status --porcelain)" ] || fail "working folder is not clean. No override flag exists for this."
[ "$(git branch --show-current)" = "main" ] || fail "not on branch main. No override flag exists for this."
git fetch origin main --quiet || fail "git fetch failed"
[ "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)" ] || fail "local HEAD does not match origin/main. No override flag exists for this."
[ -f "$ACCESS_TOKEN_FILE" ] || fail "$ACCESS_TOKEN_FILE not found: run 'supabase login' first"
[ -f "$BASELINE_DIR/baseline.sql" ] && [ -f "$BASELINE_DIR/baseline.meta.json" ] || fail "no baseline: run scripts/generate-baseline-migration.js first"

python3 - "$REGISTRY_FILE" "$NAME" <<'PY' || exit 1
import json,sys
reg=json.load(open(sys.argv[1])); n=sys.argv[2]
if any(p['name']==n for p in reg['projects']): print(f"❌ '{n}' is already in the registry"); sys.exit(1)
PY

BASE_VERSION="$(python3 -c "import json;print(json.load(open('$BASELINE_DIR/baseline.meta.json'))['represents_through_migration'])")"
LATER="$(cd "$MIGRATIONS_DIR" && ls | awk -v b="$BASE_VERSION" '{split($0,a,"_"); if (a[1] ~ /^[0-9]+$/ && a[1]>b) print $0}')"
REPLAY="$(grep -v '^#' "$BASELINE_DIR/replay-after-baseline.txt" | grep -v '^$')"

if [ "$DRY" = 1 ]; then
  echo "DRY RUN for '$NAME' in $REGION (nothing is created):"
  echo "  1 create project 'maraehub-$NAME' (Micro) in org $ORG_ID"
  echo "  2 wait until healthy"
  echo "  3 apply supabase/baseline/baseline.sql (through migration $BASE_VERSION)"
  echo "  4 replay: $(echo $REPLAY | tr '\n' ' ')"
  echo "    then $(echo "$LATER" | grep -c .) later migration(s), recording each version"
  echo "  5 deploy $(ls supabase/functions | grep -vc '^_') edge functions"
  exit 0
fi

mkdir -p "$STATE_DIR" "$SCRATCH_DIR"; chmod 700 "$SCRATCH_DIR"
trap 'rm -rf "$SCRATCH_DIR"' EXIT
STATE_FILE="$STATE_DIR/$NAME.json"; [ -f "$STATE_FILE" ] || echo '{}' > "$STATE_FILE"
TOKEN="$(cat "$ACCESS_TOKEN_FILE")"
export SUPABASE_ACCESS_TOKEN="$TOKEN"   # so the CLI never asks the keychain for it; never printed

sget() { python3 -c "import json;print(json.load(open('$STATE_FILE')).get('$1',''))"; }
sset() { python3 - "$STATE_FILE" "$1" "$2" <<'PY'
import json,sys
f,k,v=sys.argv[1:4]; d=json.load(open(f)); d[k]=v; json.dump(d,open(f,'w'))
PY
}
api() { curl -sS -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" "$@"; }
# run SQL from a file on the project; prints nothing but a pass/fail line
run_sql_file() {
  python3 -c "import json,sys;print(json.dumps({'query':open(sys.argv[1]).read()}))" "$1" > "$SCRATCH_DIR/body.json" || return 1
  local out; out="$(api -X POST "$MGMT_API/projects/$REF/database/query" --data @"$SCRATCH_DIR/body.json")"
  if echo "$out" | grep -q '"message"'; then echo "   SQL error: $(echo "$out" | head -c 400)"; return 1; fi
  return 0
}

# ── 1 create ──
REF="$(sget ref)"
if [ -z "$REF" ]; then
  echo "1/5 Creating project maraehub-$NAME in Sydney (Micro, about \$10/month)..."
  python3 - "$NAME" "$ORG_ID" "$REGION" "$SCRATCH_DIR/create.json" <<'PY'
import json,secrets,sys
n,org,region,out=sys.argv[1:5]
json.dump({"name":f"maraehub-{n}","organization_id":org,"region":region,"db_pass":secrets.token_urlsafe(32),"desired_instance_size":"micro"},open(out,'w'))
PY
  RESP="$(api -X POST "$MGMT_API/projects" --data @"$SCRATCH_DIR/create.json")"; rm -f "$SCRATCH_DIR/create.json"
  REF="$(echo "$RESP" | python3 -c "import json,sys;d=json.load(sys.stdin);print(d.get('id') or d.get('ref') or '')" 2>/dev/null)"
  [ -n "$REF" ] || fail "project not created: $(echo "$RESP" | head -c 300)"
  sset ref "$REF"
fi
echo "   project ref: $REF"

# ── 2 wait ──
echo "2/5 Waiting for the project to be healthy..."
for i in $(seq 1 60); do
  ST="$(api "$MGMT_API/projects/$REF" | python3 -c "import json,sys;print(json.load(sys.stdin).get('status',''))" 2>/dev/null)"
  [ "$ST" = "ACTIVE_HEALTHY" ] && break; sleep 10
done
[ "$ST" = "ACTIVE_HEALTHY" ] || fail "project not healthy after 10 minutes (status: ${ST:-unknown}). Run again to keep waiting."

# ── 3 baseline ──
if [ "$(sget baseline)" != "done" ]; then
  echo "3/5 Applying baseline structure (the file itself refuses to run on a project that has tables)..."
  run_sql_file "$BASELINE_DIR/baseline.sql" || fail "baseline failed. Nothing else was run."
  sset baseline done
else echo "3/5 Baseline already applied, skipping."; fi

# ── 4 seed + later migrations ──
echo "4/5 Shared seed and later migrations..."
# a brand-new project has no migration-tracking table yet: create it exactly as Supabase does
cat > "$SCRATCH_DIR/track.sql" <<'SQL'
create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (
  version text not null primary key, statements text[], name text,
  created_by text, idempotency_key text, rollback text[]);
SQL
run_sql_file "$SCRATCH_DIR/track.sql" || fail "could not create the migration-tracking table"
record() { printf "insert into supabase_migrations.schema_migrations (version, name) values ('%s','%s') on conflict do nothing;" "$1" "$2" > "$SCRATCH_DIR/rec.sql"; run_sql_file "$SCRATCH_DIR/rec.sql"; }
# migrations at or below the baseline version are already represented in it: record them all in ONE call
if [ "$(sget tracked_baseline)" != "done" ]; then
  python3 - "$MIGRATIONS_DIR" "$BASE_VERSION" "$SCRATCH_DIR/rec_all.sql" <<'PY'
import os,sys
d,b,out=sys.argv[1:4]
rows=[]
for f in sorted(os.listdir(d)):
    if not f.endswith('.sql'): continue
    v,_,n=f[:-4].partition('_')
    if v.isdigit() and v<=b: rows.append("('%s','%s')"%(v,n.replace("'","''")))
open(out,'w').write("insert into supabase_migrations.schema_migrations (version, name) values\n"+",\n".join(rows)+"\non conflict do nothing;")
PY
  run_sql_file "$SCRATCH_DIR/rec_all.sql" || fail "could not record the baseline migrations"
  sset tracked_baseline done
fi
for f in $REPLAY; do
  [ "$(sget "r_$f")" = "done" ] && continue
  echo "   replay $f"; run_sql_file "$MIGRATIONS_DIR/$f" || fail "replay of $f failed"; sset "r_$f" done
done
for f in $LATER; do
  v="${f%%_*}"; n="${f#*_}"; n="${n%.sql}"
  [ "$(sget "l_$v")" = "done" ] && continue
  echo "   apply $f"; run_sql_file "$MIGRATIONS_DIR/$f" || fail "migration $f failed; stopped here. Run again after fixing."
  record "$v" "$n" || fail "could not record $v"; sset "l_$v" done
done

# ── 5 functions ──
echo "5/5 Deploying all edge functions in one go..."
if [ "$(sget functions)" != "done" ]; then
  OUT="$(cd "$REPO_DIR" && npx supabase functions deploy --project-ref "$REF" 2>&1)" \
    || fail "function deploy failed ($(echo "$OUT" | tail -3 | tr '\n' ' ')). Run again to retry."
  sset functions done
fi

cat <<DONE

✅ maraehub-$NAME is built: structure, shared seed, migrations and functions.
Still to do before it is a real marae (later steps, not done by this script):
  - secrets from the manifest (Step 3), scheduled jobs (Step 4), Vercel project (Step 5)
  - restart the project once in the dashboard, then run provision-shield.sh $NAME $REF
  - add this entry to scripts/marae-registry.json by pull request:
    {"ref": "$REF", "name": "$NAME", "role": "production", "frontend_project": "<vercel project>"}
  - then run: node scripts/drift-check/drift-check.js --only=$NAME
DONE
