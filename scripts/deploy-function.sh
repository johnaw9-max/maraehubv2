#!/usr/bin/env bash
# Deploys one edge function to Tineka, Sandbox, then Opeke in sequence.
# Uses --project-ref directly — `functions deploy` supports targeting a
# project ref without the `supabase link` step, so this script never touches
# the shared/stateful link file at all.
# Stops immediately on any failure. Requires explicit confirmation before
# the Opeke leg, every run (ClickUp 86d3u5rjc / 86d3u5rjf).
#
# This script only deploys code — it never invokes the function on any
# project, so it can't trigger any scheduled/cron-adjacent action even on
# Opeke (Rule 3). Whether the new code actually behaves correctly is
# function-specific and deliberately not automated here — verify it the
# same way mark-action-done was verified: an explicit, manual invocation
# test, not something this script can generically infer.
set -u -o pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONF_FILE="$SCRIPT_DIR/deploy-projects.conf"

FUNCTION_NAME="${1:-}"

if [ -z "$FUNCTION_NAME" ]; then
  echo "Usage: $0 <function-name>"
  exit 1
fi
if [ ! -d "$SCRIPT_DIR/../supabase/functions/$FUNCTION_NAME" ]; then
  echo "❌ No such function directory: supabase/functions/$FUNCTION_NAME"
  exit 1
fi
if [ ! -f "$CONF_FILE" ]; then
  echo "❌ Project list not found: $CONF_FILE"
  exit 1
fi

declare -a NAMES=()
declare -a STATUS=()

print_summary() {
  echo ""
  echo "── Summary ──────────────────────────────────────────"
  for i in "${!NAMES[@]}"; do
    printf "%-10s %s\n" "${NAMES[$i]}" "${STATUS[$i]}"
  done
  echo "────────────────────────────────────────────────────"
}

while IFS=',' read -r NAME REF || [ -n "$NAME" ]; do
  [ -z "$NAME" ] && continue
  case "$NAME" in "#"*) continue ;; esac

  NAMES+=("$NAME")

  if [ "$NAME" = "opeke" ]; then
    echo ""
    echo "⚠️  Tineka succeeded. Proceed to Opeke (LIVE production)? [y/N]"
    if ! read -r CONFIRM < /dev/tty 2>/dev/null; then
      echo "❌ No terminal available — please run this script directly in your own terminal to confirm the Opeke deployment."
      STATUS+=("❌ no terminal available for confirmation")
      print_summary
      exit 1
    fi
    if [ "$CONFIRM" != "y" ] && [ "$CONFIRM" != "Y" ]; then
      STATUS+=("⏭ skipped (declined confirmation)")
      echo "Stopped before Opeke — no changes made to production."
      print_summary
      exit 1
    fi
  fi

  echo ""
  echo "── $NAME ($REF) ────────────────────────────────────"

  DEPLOY_OUTPUT=$(cd "$SCRIPT_DIR/.." && npx supabase functions deploy "$FUNCTION_NAME" --project-ref "$REF" 2>&1)
  DEPLOY_EXIT=$?
  if [ "$DEPLOY_EXIT" -ne 0 ]; then
    echo "❌ Deploy failed:"
    echo "$DEPLOY_OUTPUT"
    STATUS+=("❌ deploy failed")
    print_summary
    exit 1
  fi
  echo "✅ Deployed"

  LIST_OUTPUT=$(cd "$SCRIPT_DIR/.." && npx supabase functions list --project-ref "$REF" --output-format json 2>&1)
  PY_CODE=$(cat <<'PYEOF'
import json, sys
name = sys.argv[1]
text = sys.stdin.read()
try:
    start = text.index('[')
    obj, _ = json.JSONDecoder().raw_decode(text, start)
except (ValueError, json.JSONDecodeError):
    print("UNKNOWN (could not parse functions list output)")
    sys.exit(0)
for f in obj:
    if f.get('name') == name:
        print(f"{f.get('status')} (updated_at={f.get('updated_at')})")
        sys.exit(0)
print("NOT FOUND in functions list")
PYEOF
)
  FUNC_STATUS=$(echo "$LIST_OUTPUT" | python3 -c "$PY_CODE" "$FUNCTION_NAME")
  echo "   Status: $FUNC_STATUS"
  STATUS+=("✅ deployed — $FUNC_STATUS")

done < "$CONF_FILE"

print_summary
echo ""
echo "✅ All projects done."
echo ""
echo "Note: this confirms the deploy landed, not that the new code behaves"
echo "correctly — verify behavior with an explicit invocation test, same as"
echo "the mark-action-done click-through test."
