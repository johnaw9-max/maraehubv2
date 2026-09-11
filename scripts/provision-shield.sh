#!/usr/bin/env bash
# Provisions the maintenance shield (the check-deadlines function, its
# sb_secret_ auth key, and its pg_cron trigger) for a new marae project.
#
# Real, honest scope: this closes the deployment gap for check-deadlines
# ONLY. It does not touch the other 16 Edge Functions or the 3 other cron
# jobs that still depend on the legacy service_role key (tracked separately,
# ClickUp 14yhc7kpfer) -- see the summary this script prints at the end.
# It also assumes the target Supabase project already exists; creating it is
# a separate, unbuilt step (ClickUp 14yhc7knpbj).
#
# Two real platform gotchas this script exists to encode so they never have
# to be rediscovered by hand again (both hit for real, 2026-09-11, migrating
# check-deadlines on the test project and Opeke -- full detail in
# supabase/migrations/20260911010000_migrate_check_deadlines_cron_auth.sql):
#
#   1. A secret key just created via the Management API is not valid at the
#      gateway until the project's data plane re-syncs. There is no
#      Management API restart endpoint. The original design here used
#      pause+resume to force that resync unattended -- turned out to be
#      broken the first time it would have mattered: `POST .../pause`
#      rejects outright on any paid-tier project ("Project is not
#      free-tier. Please downgrade it to free-tier first and try again."),
#      and every real marae project is paid tier. There is no unattended
#      fix for this -- it requires a human clicking Restart project in the
#      Dashboard. This script blocks and waits for that confirmation via
#      /dev/tty, same pattern as the opeke gate in
#      deploy-function.sh/deploy-migration.sh.
#
#   2. `POST /v1/projects/{ref}/api-keys` (create) and
#      `GET /v1/projects/{ref}/api-keys/{id}?reveal=true` return DIFFERENT
#      byte strings for the same key id. Only the GET-reveal value, fetched
#      AFTER the restart above, is what the gateway actually recognizes.
#      This script enforces that ordering structurally, not by convention.
#
# Credential handling rules, carried forward from the session that
# discovered both gotchas above:
#   - Raw key values are captured into a 0600-permissioned scratch file
#     immediately after the GET-reveal call, consumed from that file via
#     python (never `cat`/`echo`d to stdout), and the file is deleted the
#     moment the value has been stored everywhere it needs to be.
#   - This script NEVER calls `GET /v1/projects/{ref}/api-keys` (the plural
#     list endpoint) for any reason -- confirmed this session that it
#     returns legacy anon/service_role keys in full plaintext regardless of
#     the `reveal` parameter. Idempotency is tracked instead via a local,
#     non-secret state file (key id only, never the key value).
#
# Requires: `supabase login` already done on this machine (reads
# ~/.supabase/access-token), python3, curl.
set -u -o pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONF_FILE="$SCRIPT_DIR/deploy-projects.conf"
STATE_DIR="$SCRIPT_DIR/.provision-state"
SCRATCH_DIR="${TMPDIR:-/tmp}/provision-shield-$$"
ACCESS_TOKEN_FILE="$HOME/.supabase/access-token"
MGMT_API="https://api.supabase.com/v1"

MARAE_NAME="${1:-}"
PROJECT_REF="${2:-}"

if [ -z "$MARAE_NAME" ] || [ -z "$PROJECT_REF" ]; then
  echo "Usage: $0 <marae-name> <project-ref>"
  exit 1
fi
if [ ! -f "$ACCESS_TOKEN_FILE" ]; then
  echo "❌ $ACCESS_TOKEN_FILE not found -- run 'supabase login' on this machine first."
  exit 1
fi

mkdir -p "$STATE_DIR" "$SCRATCH_DIR"
chmod 700 "$SCRATCH_DIR"
trap 'rm -rf "$SCRATCH_DIR"' EXIT

STATE_FILE="$STATE_DIR/$PROJECT_REF.json"
[ -f "$STATE_FILE" ] || echo '{}' > "$STATE_FILE"

ACCESS_TOKEN="$(cat "$ACCESS_TOKEN_FILE")"

state_get() {
  python3 -c "import json,sys; print(json.load(open(sys.argv[1])).get(sys.argv[2], ''))" "$STATE_FILE" "$1"
}
state_set() {
  python3 -c "
import json, sys
path, key, value = sys.argv[1], sys.argv[2], sys.argv[3]
d = json.load(open(path))
d[key] = value
json.dump(d, open(path, 'w'), indent=2)
" "$STATE_FILE" "$1" "$2"
}

fail() {
  echo "❌ $1"
  exit 1
}

echo "── Provisioning maintenance shield: $MARAE_NAME ($PROJECT_REF) ──"

# ── Step 1: confirm the project is real and reachable ───────────────────────
echo ""
echo "[1/8] Verifying project exists..."
PROJECT_HTTP=$(curl -sS -o "$SCRATCH_DIR/project.json" -w "%{http_code}" \
  "$MGMT_API/projects/$PROJECT_REF" \
  -H "Authorization: Bearer $ACCESS_TOKEN")
[ "$PROJECT_HTTP" = "200" ] || fail "Project $PROJECT_REF not reachable (HTTP $PROJECT_HTTP) -- check the ref."
echo "✅ Project reachable."

# ── Step 2: add to deploy-projects.conf (idempotent) ─────────────────────────
echo ""
echo "[2/8] Updating $CONF_FILE..."
if grep -q ",$PROJECT_REF\$" "$CONF_FILE" 2>/dev/null; then
  echo "✅ Already present."
elif grep -q "^$MARAE_NAME," "$CONF_FILE" 2>/dev/null; then
  fail "Name '$MARAE_NAME' already used in $CONF_FILE for a different ref -- pick a different name."
else
  echo "$MARAE_NAME,$PROJECT_REF" >> "$CONF_FILE"
  echo "✅ Added."
fi

# ── Step 3: create the secret key (idempotent via state file) ───────────────
echo ""
echo "[3/8] Creating check_deadlines secret key..."
KEY_ID="$(state_get secret_key_id)"
if [ -n "$KEY_ID" ]; then
  echo "✅ Already created this run's target key (id $KEY_ID) -- reusing."
else
  CREATE_HTTP=$(curl -sS -o "$SCRATCH_DIR/create.json" -w "%{http_code}" \
    -X POST "$MGMT_API/projects/$PROJECT_REF/api-keys" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -H "Content-Type: application/json" \
    --data '{"type":"secret","name":"check_deadlines","secret_jwt_template":{"role":"service_role"}}')
  [ "$CREATE_HTTP" = "201" ] || fail "Key creation failed (HTTP $CREATE_HTTP) -- see $SCRATCH_DIR/create.json"
  KEY_ID=$(python3 -c "import json; print(json.load(open('$SCRATCH_DIR/create.json'))['id'])")
  state_set secret_key_id "$KEY_ID"
  echo "✅ Created (id $KEY_ID)."
fi

# ── Step 4: force gateway resync via a manual project restart ───────────────
# No unattended path exists (see header comment -- pause/resume is rejected
# outright on paid-tier projects, which every real marae is). Requires a
# human in the loop. Skipped on re-run once already confirmed done.
echo ""
echo "[4/8] Gateway key-registry resync required..."
if [ "$(state_get gateway_synced)" = "true" ]; then
  echo "✅ Already confirmed synced on a previous run -- skipping."
else
  echo ""
  echo "⚠️  A newly-created secret key isn't valid at the gateway until the"
  echo "   project's data plane resyncs, and there's no unattended way to"
  echo "   force that (pause/resume is paid-tier-blocked; no restart API"
  echo "   exists). Please restart the project now:"
  echo "     Dashboard -> $PROJECT_REF -> Settings -> General -> Restart project"
  echo ""
  echo "Press enter once the restart has finished, or Ctrl-C to abort:"
  if ! read -r _CONFIRM < /dev/tty 2>/dev/null; then
    echo "❌ No terminal available -- run this script directly in your own terminal so you can confirm the restart."
    fail "cannot confirm restart without a terminal"
  fi
  state_set gateway_synced "true"
  echo "✅ Restart confirmed."
fi

# ── Step 5: fetch the real value (GET reveal, AFTER the resync above) ───────
echo ""
echo "[5/8] Fetching the real key value (GET reveal, post-resync)..."
REVEAL_HTTP=$(curl -sS -o "$SCRATCH_DIR/reveal.json" -w "%{http_code}" \
  "$MGMT_API/projects/$PROJECT_REF/api-keys/$KEY_ID?reveal=true" \
  -H "Authorization: Bearer $ACCESS_TOKEN")
chmod 600 "$SCRATCH_DIR/reveal.json"
[ "$REVEAL_HTTP" = "200" ] || fail "Reveal fetch failed (HTTP $REVEAL_HTTP)."
echo "✅ Fetched."

# ── Step 6: store it -- edge function secret + Vault secret ─────────────────
echo ""
echo "[6/8] Storing key as edge function secret + Vault secret..."
supabase secrets set --project-ref "$PROJECT_REF" \
  "CHECK_DEADLINES_SECRET_KEY=$(python3 -c "import json; print(json.load(open('$SCRATCH_DIR/reveal.json'))['api_key'])")" \
  || fail "supabase secrets set failed."

supabase link --project-ref "$PROJECT_REF" > /dev/null 2>&1 || fail "supabase link failed."

python3 -c "
import json
key = json.load(open('$SCRATCH_DIR/reveal.json'))['api_key']
sql = '''do \$\$
begin
  if not exists (select 1 from vault.decrypted_secrets where name = 'check_deadlines_secret_key') then
    perform vault.create_secret(%s, 'check_deadlines_secret_key',
      'apikey header value for pg_cron -> check-deadlines gateway auth, new sb_secret_ format, check-deadlines-only');
  end if;
end \$\$;''' % repr(key)
open('$SCRATCH_DIR/vault.sql', 'w').write(sql)
"
chmod 600 "$SCRATCH_DIR/vault.sql"
supabase db query --linked --file "$SCRATCH_DIR/vault.sql" > /dev/null 2>&1 || fail "Vault secret creation failed."
rm -f "$SCRATCH_DIR/reveal.json" "$SCRATCH_DIR/vault.sql"
echo "✅ Stored (and scratch copies of the raw key deleted)."

# ── Step 7: deploy the function + apply the cron migration ──────────────────
echo ""
echo "[7/8] Deploying check-deadlines and scheduling its cron job..."
"$SCRIPT_DIR/deploy-function.sh" --only "$MARAE_NAME" check-deadlines \
  || fail "Function deploy failed."

sed "s/<PROJECT_REF>/$PROJECT_REF/" \
  "$SCRIPT_DIR/../supabase/migrations/20260911010000_migrate_check_deadlines_cron_auth.sql" \
  > "$SCRATCH_DIR/cron_migration.sql"

"$SCRIPT_DIR/deploy-migration.sh" --only "$MARAE_NAME" \
  "$SCRATCH_DIR/cron_migration.sql" \
  "$SCRIPT_DIR/../supabase/verify/20260911010000_verify_migrate_check_deadlines_cron_auth.sql" \
  || fail "Cron migration failed or did not verify."
rm -f "$SCRATCH_DIR/cron_migration.sql"

# ── Step 8: real end-to-end proof, not just config checks ───────────────────
# deploy-migration.sh leaves the CLI linked to $PROJECT_REF, so this queries
# the right project directly.
echo ""
echo "[8/8] Replaying the real cron path (Vault -> net.http_post -> function)..."
cat > "$SCRATCH_DIR/e2e.sql" <<EOF
select net.http_post(
  url     := 'https://$PROJECT_REF.supabase.co/functions/v1/check-deadlines',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'apikey',       (select decrypted_secret from vault.decrypted_secrets where name = 'check_deadlines_secret_key' order by created_at desc limit 1)
  ),
  body    := '{}'::jsonb
) as request_id;
EOF
E2E_OUT=$(supabase db query --linked --file "$SCRATCH_DIR/e2e.sql" 2>&1)
REQUEST_ID=$(echo "$E2E_OUT" | python3 -c "
import json, sys
text = sys.stdin.read()
start = text.find('{')
obj, _ = json.JSONDecoder().raw_decode(text, start)
print(obj['rows'][0]['request_id'])
" 2>/dev/null)
[ -n "$REQUEST_ID" ] || fail "Could not queue the e2e request -- see: $E2E_OUT"

echo "   Waiting for response (request_id $REQUEST_ID)..."
STATUS_CODE=""
for i in $(seq 1 12); do
  sleep 5
  CHECK_OUT=$(supabase db query --linked --file <(echo "select status_code from net._http_response where id = $REQUEST_ID;") 2>&1)
  STATUS_CODE=$(echo "$CHECK_OUT" | python3 -c "
import json, sys
text = sys.stdin.read()
start = text.find('{')
try:
    obj, _ = json.JSONDecoder().raw_decode(text, start)
    rows = obj.get('rows', [])
    print(rows[0]['status_code'] if rows else '')
except Exception:
    print('')
" 2>/dev/null)
  [ -n "$STATUS_CODE" ] && break
done

if [ "$STATUS_CODE" = "200" ]; then
  echo "✅ Real cron path confirmed working end-to-end (HTTP 200)."
  state_set verified "true"
else
  fail "e2e check did not return 200 (got: '$STATUS_CODE') -- shield is deployed but NOT confirmed working. Investigate before trusting it."
fi

echo ""
echo "── Done: $MARAE_NAME ($PROJECT_REF) ──"
echo "check-deadlines is deployed, scheduled, and verified working end-to-end."
echo ""
echo "⚠️  Real, honest scope reminder: this covers check-deadlines only."
echo "    The other 16 Edge Functions and 3 other cron jobs still depend on"
echo "    the legacy service_role key on every project, including this one."
echo "    Tracked separately: ClickUp 14yhc7kpfer."
