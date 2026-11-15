#!/usr/bin/env bash
# Sets a new marae's edge-function secrets from scripts/secrets-manifest.json (Step 3 of
# ClickUp 14yhc7kw7b2). Values are never printed and never put on a command line: they go
# through a 0600 scratch file that is deleted on exit.
#
#   scripts/provision-secrets.sh <marae-name> --frontend-url https://app.example.nz [--with calendar,xero]
#   scripts/provision-secrets.sh <marae-name> --check      list what is set vs what is expected (names only)
#
# Needs the project ref: read from scripts/.provision-state/<name>.json (written by
# provision-marae.sh) or from scripts/marae-registry.json. Refuses the three live projects
# unless they are the named marae AND --check is used (read only): setting secrets on a live
# marae is a deliberate human act, not something this script does.
# Safe to run twice: setting a secret to the same value changes nothing.
set -u -o pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MANIFEST="$SCRIPT_DIR/secrets-manifest.json"
REGISTRY="$SCRIPT_DIR/marae-registry.json"
STATE_FILE_DIR="$SCRIPT_DIR/.provision-state"
SHARED_FILE="${MARAEHUB_SHARED_SECRETS:-$HOME/.maraehub/shared-secrets.env}"
SCRATCH="${TMPDIR:-/tmp}/provision-secrets-$$"
fail() { echo "❌ $1"; exit 1; }

NAME=""; FRONTEND=""; WITH=""; CHECK=0
while [ $# -gt 0 ]; do
  case "$1" in
    --frontend-url) FRONTEND="${2:-}"; shift 2 ;;
    --with) WITH="${2:-}"; shift 2 ;;
    --check) CHECK=1; shift ;;
    -*) fail "unknown flag $1" ;;
    *) NAME="$1"; shift ;;
  esac
done
[ -n "$NAME" ] || fail "Usage: $0 <marae-name> --frontend-url https://... [--with calendar,xero] | --check"

REF="$(python3 - "$STATE_FILE_DIR/$NAME.json" "$REGISTRY" "$NAME" <<'PY'
import json,os,sys
st,reg,n=sys.argv[1:4]
if os.path.exists(st):
    r=json.load(open(st)).get('ref')
    if r: print(r); sys.exit(0)
for p in json.load(open(reg))['projects']:
    if p['name']==n: print(p['ref']); sys.exit(0)
PY
)"
[ -n "$REF" ] || fail "no project ref for '$NAME' (not in .provision-state or the registry)"

# which names are expected, in which groups
mkdir -p "$SCRATCH"; chmod 700 "$SCRATCH"; trap 'rm -rf "$SCRATCH"' EXIT
python3 - "$MANIFEST" "$WITH" "$SCRATCH/plan.json" <<'PY' || exit 1
import json,sys
m=json.load(open(sys.argv[1])); with_=[g for g in sys.argv[2].split(',') if g]
for g in with_:
    if g not in m['groups']: print(f"❌ unknown group '{g}'. Groups: {', '.join(m['groups'])}"); sys.exit(1)
plan=[]
for g,v in m['groups'].items():
    if v.get('default') or g in with_:
        for s in v['secrets']: plan.append(dict(s,group=g))
json.dump(plan,open(sys.argv[3],'w'))
PY

if [ "$CHECK" = 1 ]; then
  echo "Secret NAMES on $NAME ($REF), read only:"
  HAVE="$(npx supabase secrets list --project-ref "$REF" 2>/dev/null | awk -F'|' 'NR>2 {gsub(/ /,"",$1); if ($1!="") print $1}')"
  python3 - "$SCRATCH/plan.json" "$HAVE" <<'PY'
import json,sys
plan=json.load(open(sys.argv[1])); have=set(sys.argv[2].split())
for s in plan:
    if s['source']=='platform': continue
    print(('  ✅ ' if s['name'] in have else '  ❌ missing ')+s['name']+'  ['+s['group']+', '+s['source']+']')
PY
  exit 0
fi

# ── setting secrets: only on a project that is not one of the three live ones ──
case "$REF" in cbeenk*|fwtxb*|zfefu*|autzr*) fail "$NAME is a live project. Set its secrets by hand in the dashboard; this script only sets secrets on a new marae." ;; esac
[ -n "$FRONTEND" ] || fail "--frontend-url is required (the marae's website address, https://...)"
echo "$FRONTEND" | grep -Eq '^https://[a-z0-9.-]+$' || fail "--frontend-url must look like https://name.maraehub.co.nz (https, no path)"
[ -f "$SHARED_FILE" ] || fail "shared secrets file not found: $SHARED_FILE. Copy scripts/secrets-shared.example.env there, chmod 600, fill it in."
[ "$(python3 -c "import os,sys;print(oct(os.stat(sys.argv[1]).st_mode & 0o777)[2:])" "$SHARED_FILE")" = "600" ] || fail "$SHARED_FILE must be chmod 600 (only you can read it)"

python3 - "$SCRATCH/plan.json" "$SHARED_FILE" "$FRONTEND" "$SCRATCH/secrets.env" <<'PY' || exit 1
import json,os,sys
plan,shared,front,out=sys.argv[1:5]
vals={}
for line in open(shared):
    line=line.strip()
    if line and not line.startswith('#') and '=' in line:
        k,v=line.split('=',1); vals[k.strip()]=v.strip()
derived={'FRONTEND_URL':front,'APP_URL':front,'GOOGLE_REDIRECT_URI':None,'XERO_REDIRECT_URI':None}
missing=[]; manual=[]; lines=[]
for s in json.load(open(plan)):
    n,src=s['name'],s['source']
    if src=='platform': continue
    if src=='derived':
        if derived.get(n): lines.append(f"{n}={derived[n]}")
        else: manual.append(n+' (needs the project URL / provider setup)')
    elif src=='shared':
        if vals.get(n): lines.append(f"{n}={vals[n]}")
        else: missing.append(n)
    else: manual.append(n)
if missing:
    print('❌ not filled in your shared secrets file: '+', '.join(missing)); sys.exit(1)
fd=os.open(out,os.O_WRONLY|os.O_CREAT|os.O_TRUNC,0o600)
open(fd,'w').write('\n'.join(lines)+'\n')
print('Will set (names only): '+', '.join(l.split('=')[0] for l in lines))
if manual: print('Left for a person (not set here): '+', '.join(manual))
PY
[ $? -eq 0 ] || exit 1

npx supabase secrets set --env-file "$SCRATCH/secrets.env" --project-ref "$REF" >/dev/null 2>&1 \
  || fail "could not set the secrets (nothing was printed so no value can leak). Check 'supabase login' and the ref."
echo "✅ secrets set on $NAME. Verify names with: $0 $NAME --check"
