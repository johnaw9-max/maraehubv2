#!/usr/bin/env bash
# Applies a migration or an edge function to every marae project listed in
# scripts/marae-registry.json, in role order (test, then canary, then
# production), non-interactively. Part of 14yhc7kw74b ("One MaraeHub for
# every marae: every change reaches every marae, current and future").
#
# Scope (v1): migrations and edge functions only. Cron jobs, Vault secrets,
# and edge-function secrets are deliberately NOT covered here -- see the
# registry file's own comment, and 14yhc7kw74b Part C for what's left for
# a later round.
#
# Refusal rules below have NO override flag, in any version. If one of
# these fires, the fix is to commit/push/switch branch, not to force past it:
#   - the git working folder this script lives in must be clean
#   - the current branch must be main
#   - local HEAD must match origin/main (so an unpushed, unreviewed commit
#     can never be deployed either)
# Deploys then run from a disposable git worktree checked out at that exact
# commit -- never the working folder itself -- removed on exit no matter
# how the script ends.
set -u -o pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$SCRIPT_DIR/.."
REGISTRY_FILE="$SCRIPT_DIR/marae-registry.json"
WORKTREE_DIR="${TMPDIR:-/tmp}/apply-to-all-$$"

fail() { echo "❌ $1"; exit 1; }

usage() {
  cat <<'EOF'
Usage:
  apply-to-all.sh --kind migration <file> [verify-file] [--dry-run] [--up-to test|canary|production]
  apply-to-all.sh --kind function <name> [--dry-run] [--up-to test|canary|production]

--up-to controls how far through the role order to go (default: production,
i.e. run every project). Use --up-to test to stop after the test project,
or --up-to canary to stop after the canary, for a staged rollout.
EOF
}

# ── Refusal checks -- run against THIS checkout, before anything else ──────
cd "$REPO_DIR" || fail "cannot cd to repo root"

if [ -n "$(git status --porcelain)" ]; then
  fail "working folder is not clean -- commit, stash, or discard first. No override flag exists for this."
fi

CURRENT_BRANCH="$(git branch --show-current)"
if [ "$CURRENT_BRANCH" != "main" ]; then
  fail "not on branch main (on '${CURRENT_BRANCH:-detached HEAD}'). No override flag exists for this."
fi

git fetch origin main --quiet || fail "git fetch origin main failed"
LOCAL_HEAD="$(git rev-parse HEAD)"
REMOTE_HEAD="$(git rev-parse origin/main)"
if [ "$LOCAL_HEAD" != "$REMOTE_HEAD" ]; then
  fail "local HEAD ($LOCAL_HEAD) does not match origin/main ($REMOTE_HEAD) -- push or pull first. No override flag exists for this."
fi

[ -f "$REGISTRY_FILE" ] || fail "Registry not found: $REGISTRY_FILE"

# ── Args ──────────────────────────────────────────────────────────────────
KIND=""
DRY_RUN=0
UP_TO="production"
POSITIONAL=()
while [ $# -gt 0 ]; do
  case "$1" in
    --kind) KIND="${2:-}"; shift 2 ;;
    --dry-run) DRY_RUN=1; shift ;;
    --up-to) UP_TO="${2:-}"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) POSITIONAL+=("$1"); shift ;;
  esac
done

case "$KIND" in
  migration|function) ;;
  *) usage; exit 1 ;;
esac

case "$UP_TO" in
  test|canary|production) ;;
  *) fail "--up-to must be one of: test, canary, production" ;;
esac

MIGRATION_FILE=""
VERIFY_FILE=""
VERSION=""
FUNCTION_NAME=""

if [ "$KIND" = "migration" ]; then
  MIGRATION_FILE="${POSITIONAL[0]:-}"
  VERIFY_FILE="${POSITIONAL[1]:-}"
  [ -n "$MIGRATION_FILE" ] || fail "migration file required"
  [ -f "$MIGRATION_FILE" ] || fail "Migration file not found: $MIGRATION_FILE"
  if [ -n "$VERIFY_FILE" ] && [ ! -f "$VERIFY_FILE" ]; then
    fail "Verify file not found: $VERIFY_FILE"
  fi
  if [ -z "$VERIFY_FILE" ]; then
    echo "⚠️  No verify-file given -- only a clean exit code will be confirmed per project. Strongly recommended."
  fi
  MIGRATION_FILE="$(cd "$(dirname "$MIGRATION_FILE")" && pwd)/$(basename "$MIGRATION_FILE")"
  [ -n "$VERIFY_FILE" ] && VERIFY_FILE="$(cd "$(dirname "$VERIFY_FILE")" && pwd)/$(basename "$VERIFY_FILE")"
  VERSION="$(basename "$MIGRATION_FILE" | grep -oE '^[0-9]+' || true)"
  [ -n "$VERSION" ] || fail "Could not extract a leading numeric version from $(basename "$MIGRATION_FILE")"
else
  FUNCTION_NAME="${POSITIONAL[0]:-}"
  [ -n "$FUNCTION_NAME" ] || fail "function name required"
  [ -d "$REPO_DIR/supabase/functions/$FUNCTION_NAME" ] || fail "No such function directory: supabase/functions/$FUNCTION_NAME"
fi

# ── Registry reading, role-ordered ──────────────────────────────────────────
# A function or job is assumed to belong on every project unless this
# project's excluded_functions/excluded_jobs says otherwise, with a reason.
# For --kind function, resolves whether FUNCTION_NAME is excluded on each
# project and its reason; for --kind migration this is unused (empty).
projects_in_order() {
  python3 -c "
import json, sys
registry = json.load(open(sys.argv[1]))
order = {'test': 0, 'canary': 1, 'production': 2}
up_to = order[sys.argv[2]]
fn = sys.argv[3] if len(sys.argv) > 3 else ''
projects = [p for p in registry['projects'] if order.get(p['role'], 99) <= up_to]
projects.sort(key=lambda p: order.get(p['role'], 99))
for p in projects:
    excluded, reason = '0', ''
    for ex in p.get('excluded_functions', []):
        if ex['name'] == fn:
            excluded, reason = '1', ex['reason']
            break
    print(f\"{p['name']}|{p['ref']}|{p['role']}|{excluded}|{reason}\")
" "$REGISTRY_FILE" "$UP_TO" "${FUNCTION_NAME:-}"
}

# ── Dry run: no worktree, no execution, just what-would-happen ─────────────
if [ "$DRY_RUN" -eq 1 ]; then
  echo "── DRY RUN (--up-to $UP_TO) -- nothing will be executed ──"
  while IFS='|' read -r NAME REF ROLE EXCLUDED REASON; do
    echo ""
    echo "── $NAME ($REF) [$ROLE] ────────────────────────────────────"
    if [ "$KIND" = "migration" ]; then
      echo "Would run:    supabase db query --project-ref $REF --file $(basename "$MIGRATION_FILE")"
      if [ -n "$VERIFY_FILE" ]; then
        echo "Would verify: supabase db query --project-ref $REF --file $(basename "$VERIFY_FILE")"
      else
        echo "Would verify: (nothing -- no verify-file given)"
      fi
      echo "Would then register version $VERSION in supabase_migrations.schema_migrations on $REF."
    else
      if [ "$EXCLUDED" = "1" ]; then
        echo "Would skip: '$FUNCTION_NAME' is excluded on $NAME -- $REASON"
      else
        echo "Would run: supabase functions deploy $FUNCTION_NAME --project-ref $REF"
      fi
    fi
  done < <(projects_in_order)
  echo ""
  echo "── Dry run complete. Nothing was executed, nothing was changed. ──"
  exit 0
fi

# ── Real run: disposable worktree, cleaned up on any exit ──────────────────
trap 'rm -rf "$WORKTREE_DIR"' EXIT
git worktree add --quiet --detach "$WORKTREE_DIR" "$LOCAL_HEAD" || fail "could not create disposable worktree"

declare -a NAMES=()
declare -a STATUSES=()

print_summary() {
  echo ""
  echo "── Summary ──────────────────────────────────────────"
  for i in "${!NAMES[@]}"; do
    printf "%-10s %s\n" "${NAMES[$i]}" "${STATUSES[$i]}"
  done
  echo "────────────────────────────────────────────────────"
}

# Same JSON-envelope-tolerant verify logic already used by deploy-migration.sh.
verify_rows() {
  python3 <(cat <<'PYEOF'
import json, sys
text = sys.stdin.read()
starts = [i for i in (text.find('{'), text.find('[')) if i != -1]
if not starts:
    print("NO_JSON"); sys.exit(1)
start = min(starts)
try:
    obj, _ = json.JSONDecoder().raw_decode(text, start)
except json.JSONDecodeError:
    print("BAD_JSON"); sys.exit(1)
rows = obj.get('rows', []) if isinstance(obj, dict) else (obj if isinstance(obj, list) else [])
if not rows:
    print("EMPTY_RESULT"); sys.exit(1)
failed = [r for r in rows if r.get('result') is not True]
for r in rows:
    print(("PASS" if r.get('result') is True else "FAIL") + ": " + str(r.get('check_name', '?')))
sys.exit(1 if failed else 0)
PYEOF
)
}

while IFS='|' read -r NAME REF ROLE EXCLUDED REASON; do
  NAMES+=("$NAME")
  echo ""
  echo "── $NAME ($REF) [$ROLE] ────────────────────────────────────"

  if [ "$KIND" = "function" ]; then
    if [ "$EXCLUDED" = "1" ]; then
      echo "⏭ skipped — $FUNCTION_NAME is excluded on $NAME: $REASON"
      STATUSES+=("⏭ skipped ($REASON)")
      continue
    fi

    DEPLOY_OUTPUT=$(cd "$WORKTREE_DIR" && npx supabase functions deploy "$FUNCTION_NAME" --project-ref "$REF" 2>&1)
    DEPLOY_EXIT=$?
    if [ "$DEPLOY_EXIT" -ne 0 ]; then
      echo "❌ Deploy failed:"; echo "$DEPLOY_OUTPUT"
      STATUSES+=("❌ deploy failed"); print_summary; exit 1
    fi
    echo "✅ Deployed"
    STATUSES+=("✅ deployed")

  else
    LINK_OUTPUT=$(cd "$WORKTREE_DIR" && npx supabase link --project-ref "$REF" 2>&1)
    ACTUAL_REF=$(cat "$WORKTREE_DIR/supabase/.temp/project-ref" 2>/dev/null || echo "")
    if [ "$ACTUAL_REF" != "$REF" ]; then
      echo "❌ Link mismatch: expected '$REF', found '$ACTUAL_REF'"; echo "$LINK_OUTPUT"
      STATUSES+=("❌ link mismatch"); print_summary; exit 1
    fi
    echo "✅ Linked and confirmed: $ACTUAL_REF"

    APPLY_OUTPUT=$(cd "$WORKTREE_DIR" && npx supabase db query --linked --file "$MIGRATION_FILE" --output json 2>&1)
    APPLY_EXIT=$?
    if [ "$APPLY_EXIT" -ne 0 ]; then
      echo "❌ Migration failed to apply:"; echo "$APPLY_OUTPUT"
      STATUSES+=("❌ apply failed"); print_summary; exit 1
    fi
    echo "✅ Applied without error"

    if [ -n "$VERIFY_FILE" ]; then
      VERIFY_OUTPUT=$(cd "$WORKTREE_DIR" && npx supabase db query --linked --file "$VERIFY_FILE" --output json 2>&1)
      VERIFY_RESULT=$(echo "$VERIFY_OUTPUT" | verify_rows)
      VERIFY_EXIT=$?
      echo "$VERIFY_RESULT"
      if [ "$VERIFY_EXIT" -ne 0 ]; then
        echo "❌ Verification failed — the migration did NOT provably take effect as expected."
        STATUSES+=("❌ verify failed"); print_summary; exit 1
      fi
      echo "✅ Verified"
    else
      echo "⚠️  Unverified -- no verify-file given."
    fi

    REG_SQL="insert into supabase_migrations.schema_migrations (version) values ('$VERSION') on conflict do nothing;"
    REG_OUTPUT=$(cd "$WORKTREE_DIR" && npx supabase db query --linked "$REG_SQL" 2>&1)
    REG_EXIT=$?
    if [ "$REG_EXIT" -ne 0 ]; then
      echo "❌ Applied and verified, but failed to register in migration tracking:"; echo "$REG_OUTPUT"
      STATUSES+=("❌ tracking update failed"); print_summary; exit 1
    fi
    echo "✅ Registered version $VERSION in migration tracking"
    STATUSES+=("✅ applied + verified + tracked")
  fi
done < <(projects_in_order)

print_summary
echo ""
echo "✅ All projects done (up to role: $UP_TO)."
