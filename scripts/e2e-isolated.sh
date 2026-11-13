#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

ESCLUSI="studio,realtime,edge-runtime,logflare,vector,imgproxy,mailpit,postgres-meta,supavisor"
TEMP_DIR=$(mktemp -d "${TMPDIR:-/tmp}/cronache-e2e.XXXXXX")
SUPABASE_DIR="$TEMP_DIR/supabase"
PROJECT_SUFFIX=$(basename "$TEMP_DIR" | cut -d. -f2)
PROJECT_ID="cronache-e2e-$PROJECT_SUFFIX"
BASE_PORT=$((56000 + RANDOM % 1000 * 8))
STARTED=0

cleanup() {
  local result=$?
  trap - EXIT
  if [[ "$STARTED" -eq 1 ]] && ! pnpm exec supabase stop --workdir "$TEMP_DIR" --no-backup >/dev/null; then
    echo "Impossibile arrestare il progetto Supabase temporaneo." >&2
    result=1
  fi
  if ! rm -rf -- "$TEMP_DIR"; then
    echo "Impossibile rimuovere la directory temporanea $TEMP_DIR." >&2
    result=1
  fi
  exit "$result"
}
trap cleanup EXIT

cp -R supabase "$TEMP_DIR/"
API_PORT=$BASE_PORT
DB_PORT=$((BASE_PORT + 1))
SHADOW_PORT=$((BASE_PORT + 2))
POOLER_PORT=$((BASE_PORT + 3))
STUDIO_PORT=$((BASE_PORT + 4))
SMTP_PORT=$((BASE_PORT + 5))
ANALYTICS_PORT=$((BASE_PORT + 6))
sed \
  -e "s/^project_id = .*/project_id = \"$PROJECT_ID\"/" \
  -e "s/^port = 54321$/port = $API_PORT/" \
  -e "s/^port = 54322$/port = $DB_PORT/" \
  -e "s/^shadow_port = 54320$/shadow_port = $SHADOW_PORT/" \
  -e "s/^port = 54329$/port = $POOLER_PORT/" \
  -e "s/^port = 54323$/port = $STUDIO_PORT/" \
  -e "s/^port = 54324$/port = $SMTP_PORT/" \
  -e "s/^port = 54327$/port = $ANALYTICS_PORT/" \
  "$SUPABASE_DIR/config.toml" > "$SUPABASE_DIR/config.toml.tmp"
mv "$SUPABASE_DIR/config.toml.tmp" "$SUPABASE_DIR/config.toml"

echo "▶ Avvio Supabase temporaneo ($PROJECT_ID) sulle porte da $BASE_PORT…"
pnpm exec supabase start --workdir "$TEMP_DIR" -x "$ESCLUSI"
STARTED=1

echo "▶ Database temporaneo da zero con tutte le migrazioni…"
pnpm exec supabase db reset --workdir "$TEMP_DIR" --local

echo "▶ Test SQL delle regole di visibilità…"
RESULT=$(docker exec -i "supabase_db_$PROJECT_ID" psql -U postgres -v ON_ERROR_STOP=0 -q < "$SUPABASE_DIR/tests/visibilita.sql" 2>&1 || true)
echo "$RESULT" | grep -E "✅|❌" || { echo "$RESULT"; exit 1; }
echo "$RESULT" | grep -q "✅" || exit 1

STATUS=$(pnpm exec supabase status --workdir "$TEMP_DIR" -o env)
API_URL=$(printf '%s\n' "$STATUS" | sed -n 's/^API_URL=//p' | tr -d '"')
ANON_KEY=$(printf '%s\n' "$STATUS" | sed -n 's/^ANON_KEY=//p' | tr -d '"')
PUBLISHABLE_KEY=$(printf '%s\n' "$STATUS" | sed -n 's/^PUBLISHABLE_KEY=//p' | tr -d '"')
if [[ -z "$API_URL" || -z "$ANON_KEY" ]]; then
  echo "Supabase non ha restituito API_URL e ANON_KEY." >&2
  exit 1
fi
export NEXT_PUBLIC_SUPABASE_URL="$API_URL"
export NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="${PUBLISHABLE_KEY:-$ANON_KEY}"
export AI_PROVIDER=finto

echo "▶ Test dell'interfaccia (Playwright)…"
pnpm exec playwright test "$@"
