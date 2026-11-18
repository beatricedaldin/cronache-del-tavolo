#!/usr/bin/env bash
# Supabase locale (Docker), acceso e spento solo quando lo chiedi tu.
# Uso: pnpm db:start | pnpm db:stop | pnpm db:status
set -euo pipefail
cd "$(dirname "$0")/.."

# Servizi che l'app non usa: restano spenti per risparmiare memoria.
ESCLUSI="studio,realtime,edge-runtime,logflare,vector,imgproxy,mailpit,postgres-meta,supavisor"
PROJECT_ID=$(grep '^project_id' supabase/config.toml | cut -d'"' -f2)

case "${1:-}" in
  start)
    pnpm exec supabase start -x "$ESCLUSI"
    # Il CLI crea i container con "restart: unless-stopped": ripartirebbero da soli
    # a ogni riavvio di Docker o del Mac. Qui si toglie, così si accendono solo con db:start.
    docker ps -aq --filter "name=supabase_.*_${PROJECT_ID}" | xargs -r docker update --restart=no >/dev/null
    ;;
  stop)
    pnpm exec supabase stop
    ;;
  status)
    pnpm exec supabase status
    ;;
  *)
    echo "Uso: pnpm db:start | pnpm db:stop | pnpm db:status" >&2
    exit 1
    ;;
esac
