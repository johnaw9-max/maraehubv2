#!/usr/bin/env bash
# Applies a migration file to Tineka, Sandbox, then Opeke in sequence.
# Stops immediately on any failure — never continues to the next project.
# Requires explicit confirmation before the Opeke leg, every run, regardless
# of how many times this has succeeded before (ClickUp 86d3u5rjc / 86d3u5rjf).
set -u -o pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONF_FILE="$SCRIPT_DIR/deploy-projects.conf"

MIGRATION_FILE="${1:-}"
VERIFY_FILE="${2:-}"

if [ -z "$MIGRATION_FILE" ]; then
  echo "Usage: $0 <migration-file> [verify-file]"
  exit 1
fi
if [ ! -f "$MIGRATION_FILE" ]; then
  echo "❌ Migration file not found: $MIGRATION_FILE"
  exit 1
fi
if [ -n "$VERIFY_FILE" ] && [ ! -f "$VERIFY_FILE" ]; then
  echo "❌ Verify file not found: $VERIFY_FILE"
  exit 1
fi
if [ ! -f "$CONF_FILE" ]; then
  echo "❌ Project list not found: $CONF_FILE"
  exit 1
fi

if [ -z "$VERIFY_FILE" ]; then
  echo "⚠️  No verify-file given. Only a clean exit code will be confirmed for"
  echo "   each project — that does NOT prove the change actually took effect"
  echo "   (Rule 4: never trust a migration's applied status alone). Strongly"
  echo "   recommended: pass a verify-file with 'check_name, result' rows,"
  echo "   same pattern used for every migration verified this week."
  echo ""
fi

# Extracts the JSON value from `supabase db query`'s output, which is
# surrounded by non-JSON lines ("Initialising login role...", CLI update
# notices). raw_decode() parses starting at the first bracket and ignores
# whatever text follows the matching close, rather than requiring the whole
# stream to be valid JSON on its own.
#
# The CLI's --output json envelope shape depends on its own agent
# auto-detection, NOT on how this script invokes it: run by an AI agent it
# wraps rows as {"rows": [...], "boundary": ..., "warning": ...}; run by a
# human (e.g. Waj testing the script by hand, --agent=no or no agent
# detected) it prints a bare [...] array instead, with no "rows" key at
# all. Blindly seeking the first '{' breaks on the bare-array case: that
# '{' belongs to the *first row*, not a top-level object, so raw_decode
# only ever sees one row with no "rows" key -> false EMPTY_RESULT even
# when the query genuinely returned rows. Seek whichever of '{' or '['
# comes first instead, and branch on the resulting type.
verify_rows() {
  # python3 must NOT read its own script from the same stdin the piped
  # verify-output arrives on ("python3 - <<PYEOF" does exactly that: the
  # heredoc satisfies python's "read program from stdin" request, fully
  # draining fd 0 before sys.stdin.read() below ever runs, which always
  # yields an empty string -> NO_JSON, even when the piped JSON is valid).
  # Process-substituting the heredoc into its own fd keeps stdin free for
  # the actual data.
  python3 <(cat <<'PYEOF'
import json, sys
text = sys.stdin.read()
starts = [i for i in (text.find('{'), text.find('[')) if i != -1]
if not starts:
    print("NO_JSON")
    sys.exit(1)
start = min(starts)
try:
    obj, _ = json.JSONDecoder().raw_decode(text, start)
except json.JSONDecodeError:
    print("BAD_JSON")
    sys.exit(1)
if isinstance(obj, dict):
    rows = obj.get('rows', [])
elif isinstance(obj, list):
    rows = obj
else:
    rows = []
if not rows:
    print("EMPTY_RESULT")
    sys.exit(1)
failed = [r for r in rows if r.get('result') is not True]
for r in rows:
    mark = "PASS" if r.get('result') is True else "FAIL"
    print(f"{mark}: {r.get('check_name', '?')}")
sys.exit(1 if failed else 0)
PYEOF
)
}

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

  LINK_OUTPUT=$(cd "$SCRIPT_DIR/.." && npx supabase link --project-ref "$REF" 2>&1)
  ACTUAL_REF=$(cat "$SCRIPT_DIR/../supabase/.temp/project-ref" 2>/dev/null || echo "")
  if [ "$ACTUAL_REF" != "$REF" ]; then
    echo "❌ Link mismatch: expected '$REF', found '$ACTUAL_REF'"
    echo "$LINK_OUTPUT"
    STATUS+=("❌ link mismatch")
    print_summary
    exit 1
  fi
  echo "✅ Linked and confirmed: $ACTUAL_REF"

  APPLY_OUTPUT=$(cd "$SCRIPT_DIR/.." && npx supabase db query --linked --file "$MIGRATION_FILE" --output json 2>&1)
  APPLY_EXIT=$?
  if [ "$APPLY_EXIT" -ne 0 ]; then
    echo "❌ Migration failed to apply:"
    echo "$APPLY_OUTPUT"
    STATUS+=("❌ apply failed")
    print_summary
    exit 1
  fi
  echo "✅ Applied without error"

  if [ -n "$VERIFY_FILE" ]; then
    VERIFY_OUTPUT=$(cd "$SCRIPT_DIR/.." && npx supabase db query --linked --file "$VERIFY_FILE" --output json 2>&1)
    VERIFY_RESULT=$(echo "$VERIFY_OUTPUT" | verify_rows)
    VERIFY_EXIT=$?
    echo "$VERIFY_RESULT"
    if [ "$VERIFY_EXIT" -ne 0 ]; then
      echo "❌ Verification failed — the migration did NOT provably take effect as expected."
      STATUS+=("❌ verify failed")
      print_summary
      exit 1
    fi
    echo "✅ Verified"
    STATUS+=("✅ applied + verified")
  else
    STATUS+=("✅ applied (unverified — no verify-file given)")
  fi

done < "$CONF_FILE"

print_summary
echo ""
echo "✅ All projects done."
