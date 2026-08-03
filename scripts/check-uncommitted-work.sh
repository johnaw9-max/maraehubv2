#!/bin/bash
# Detects uncommitted git changes that have been sitting for longer than a
# threshold. Manual run only for now — no scheduling wired up yet (ClickUp
# 86d3x3yrb: launchd/cron scheduling is separate, next-session work).
#
# Age is measured from each dirty file's mtime, not from when git first saw
# it as dirty — a file's last-write time is the closest available proxy for
# "how long has this been sitting uncommitted" without maintaining separate
# state between runs.

set -euo pipefail

REPO_DIR="${1:-/Users/usermac/Downloads/maraehubv2}"
THRESHOLD_HOURS=4
THRESHOLD_SECONDS=$((THRESHOLD_HOURS * 3600))

cd "$REPO_DIR"

DIRTY_LINES=$(git status --short)

if [ -z "$DIRTY_LINES" ]; then
  echo "Clean — no uncommitted changes in $REPO_DIR."
  exit 0
fi

NOW=$(date +%s)
STALE_FOUND=0

while IFS= read -r LINE; do
  [ -z "$LINE" ] && continue
  FILE=$(echo "$LINE" | awk '{print $NF}')

  if [ ! -e "$FILE" ]; then
    echo "note: $FILE no longer exists on disk (deleted) — skipping age check"
    continue
  fi

  MTIME=$(stat -f %m "$FILE" 2>/dev/null || stat -c %Y "$FILE" 2>/dev/null)
  AGE=$((NOW - MTIME))
  AGE_HOURS=$((AGE / 3600))

  if [ "$AGE" -gt "$THRESHOLD_SECONDS" ]; then
    echo "WARNING: $FILE has been uncommitted for ~${AGE_HOURS}h (threshold: ${THRESHOLD_HOURS}h)"
    STALE_FOUND=1
  else
    echo "ok: $FILE uncommitted for ~${AGE_HOURS}h (under threshold)"
  fi
done <<< "$DIRTY_LINES"

echo ""
if [ "$STALE_FOUND" -eq 1 ]; then
  echo "=== ALERT: one or more files have uncommitted changes older than ${THRESHOLD_HOURS}h ==="
  exit 1
else
  echo "All uncommitted changes are under the ${THRESHOLD_HOURS}h threshold."
  exit 0
fi
