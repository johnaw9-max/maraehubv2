#!/usr/bin/env bash
# Creates a new marae's scheduled jobs from scripts/cron-templates/*.sql (Step 4 of ClickUp
# 14yhc7kw7b2). Safe to run twice: each template unschedules its own job name first.
#
#   scripts/provision-cron.sh <marae-name> [--dry-run]
#
# Rules: only a new marae (refuses Opeke, Terere, Test, Iwi Hub); every template is checked
# so that, after {{REF}} is filled in, the ONLY project reference in it is the target's;
# needs the project's secret key already in Vault (run provision-shield.sh first: the jobs
# authenticate with it); never prints a key. The check-deadlines job itself is created by
# provision-shield.sh, not here.
set -u -o pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMPLATES="$SCRIPT_DIR/cron-templates"
STATE_DIR="$SCRIPT_DIR/.provision-state"
REGISTRY="$SCRIPT_DIR/marae-registry.json"
TOKEN_FILE="$HOME/.supabase/access-token"
MGMT_API="https://api.supabase.com/v1"
SCRATCH="${TMPDIR:-/tmp}/provision-cron-$$"
fail() { echo "❌ $1"; exit 1; }

NAME=""; DRY=0
for a in "$@"; do case "$a" in --dry-run) DRY=1 ;; -*) fail "unknown flag $a" ;; *) NAME="$a" ;; esac; done
[ -n "$NAME" ] || fail "Usage: $0 <marae-name> [--dry-run]"

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
case "$REF" in cbeenk*|fwtxb*|zfefu*|autzr*) fail "$NAME is a live project. This script only schedules jobs on a new marae." ;; esac
[ "$DRY" = 1 ] || [ -f "$TOKEN_FILE" ] || fail "run 'supabase login' first"

mkdir -p "$SCRATCH"; chmod 700 "$SCRATCH"; trap 'rm -rf "$SCRATCH"' EXIT
for t in "$TEMPLATES"/*.sql; do
  job="$(basename "$t" .sql)"
  # after filling {{REF}}, every *.supabase.co host in the file must be the target's
  python3 - "$t" "$REF" "$SCRATCH/$job.sql" <<'PY' || fail "template $job failed its project-reference check"
import re,sys
src,ref,out=sys.argv[1:4]
txt=open(src).read().replace('{{REF}}',ref)
hosts=set(re.findall(r'([a-z0-9]{20})\.supabase\.co',txt))
if hosts!={ref}: print(f"project references found: {sorted(hosts)}"); sys.exit(1)
open(out,'w').write(txt)
PY
  if [ "$DRY" = 1 ]; then echo "  would schedule: $job"; continue; fi
  python3 -c "import json,sys;print(json.dumps({'query':open(sys.argv[1]).read()}))" "$SCRATCH/$job.sql" > "$SCRATCH/body.json"
  OUT="$(curl -sS -X POST -H "Authorization: Bearer $(cat "$TOKEN_FILE")" -H "Content-Type: application/json" "$MGMT_API/projects/$REF/database/query" --data @"$SCRATCH/body.json")"
  if echo "$OUT" | grep -q '"message"'; then fail "$job failed: $(echo "$OUT" | head -c 300)"; fi
  echo "  ✅ scheduled $job"
done
[ "$DRY" = 1 ] && echo "DRY RUN: nothing was changed." || echo "✅ scheduled jobs set on $NAME. Check with: select jobname, schedule from cron.job;"
