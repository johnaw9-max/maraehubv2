#!/usr/bin/env bash
# Runs the Phase 1 proposed migrations against a throwaway local PostgreSQL.
# Usage: PGHOST=/tmp PGPORT=54329 PGUSER=postgres bash scripts/phase1-tests/sql/run.sh
set -euo pipefail
cd "$(dirname "$0")"
DB=phase1_test_$$
psql -q -c "create database $DB"
trap 'psql -q -c "drop database if exists $DB" >/dev/null' EXIT
psql -q -d "$DB" -v ON_ERROR_STOP=1 -f 00_supabase_stub.sql
psql -q -d "$DB" -v ON_ERROR_STOP=1 -f 10_tests.sql 2>&1 | grep -E "PASS|FINDING|===|ERROR|exception" | sed 's/^psql:[^ ]* NOTICE:  //'
