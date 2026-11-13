#!/usr/bin/env bash
# Test completi in locale: Supabase in Docker + browser vero.
# Uso: pnpm test:e2e            (tutti i test)
#      pnpm test:e2e --ui       (con l'interfaccia di Playwright)
set -euo pipefail
cd "$(dirname "$0")/.."

ESCLUSI="studio,realtime,edge-runtime,logflare,vector,imgproxy,mailpit,postgres-meta,supavisor"

echo "▶ Avvio Supabase locale (Docker)…"
pnpm exec supabase start -x "$ESCLUSI" >/dev/null

echo "▶ Database da zero con tutte le migrazioni…"
pnpm exec supabase db reset --local >/dev/null

echo "▶ Test SQL delle regole di visibilità…"
DB_URL=$(pnpm exec supabase status -o env | grep '^DB_URL=' | cut -d= -f2- | tr -d '"')
RESULT=$(docker exec -i "supabase_db_$(grep '^project_id' supabase/config.toml | cut -d'"' -f2)" psql -U postgres -v ON_ERROR_STOP=0 -q < supabase/tests/visibilita.sql 2>&1 || true)
echo "$RESULT" | grep -E "✅|❌" || { echo "$RESULT"; exit 1; }
echo "$RESULT" | grep -q "✅" || exit 1

eval "$(pnpm exec supabase status -o env | grep -E '^(API_URL|ANON_KEY|PUBLISHABLE_KEY)=')"
export NEXT_PUBLIC_SUPABASE_URL="$API_URL"
export NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="${PUBLISHABLE_KEY:-$ANON_KEY}"
unset DB_URL

echo "▶ Test dell'interfaccia (Playwright)…"
pnpm exec playwright test "$@"
