#!/usr/bin/env bash
#
# Aggiornamento in produzione.
#
# Scarica l'ultima versione da `main` e riavvia i container Docker con la nuova
# immagine. NON tocca i volumi: database (`pgdata`) e file caricati (`storage`)
# restano intatti. Il servizio `migrate` viene rieseguito automaticamente da
# `up` (migration + seed sono idempotenti) prima che web/worker ripartano.
#
# Uso, sul server di produzione (da qualsiasi cartella):
#   ./scripts/update-prod.sh
#
# Prerequisiti: il repo è già clonato e configurato, con `.env.production`
# compilato nella radice, e lo stack è già stato avviato almeno una volta come
# descritto in docs/deploy-docker.md.
set -euo pipefail

# Radice del repo = cartella superiore a quella dello script, così funziona a
# prescindere dalla directory da cui viene lanciato.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

ENV_FILE=".env.production"
COMPOSE_FILE="docker-compose.prod.yml"
PROJECT_NAME="controllo-timbrature-metema-prod"
BRANCH="main"

# --- Controlli preliminari -------------------------------------------------
if [ ! -f "$ENV_FILE" ]; then
  echo "Errore: manca $ENV_FILE nella radice del repo ($REPO_ROOT)." >&2
  echo "Copialo da .env.production.example e compilalo (vedi docs/deploy-docker.md)." >&2
  exit 1
fi

# Sceglie il comando compose disponibile e ricostruisce l'invocazione ESATTA
# usata per avviare lo stack, così agisce sullo stesso progetto: docker-compose
# v1 (col trattino) richiede -p per isolare il progetto di produzione; con
# docker compose v2 il project name lo dà la cartella e -p non serve.
if docker compose version >/dev/null 2>&1; then
  DC=(docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE")
elif command -v docker-compose >/dev/null 2>&1; then
  DC=(docker-compose --env-file "$ENV_FILE" -p "$PROJECT_NAME" -f "$COMPOSE_FILE")
else
  echo "Errore: non trovo né 'docker compose' (v2) né 'docker-compose' (v1)." >&2
  exit 1
fi

# --- Aggiornamento del codice ----------------------------------------------
# --ff-only: si aggiorna solo se è un avanzamento lineare di main. Se fallisce,
# meglio fermarsi con un errore chiaro che creare un merge inatteso sul server.
echo "==> Aggiornamento del codice da origin/$BRANCH…"
git fetch --prune origin
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH"

# --- Rebuild e riavvio ------------------------------------------------------
echo "==> Build della nuova immagine…"
"${DC[@]}" build

# `up -d` ricrea solo i container il cui contenuto è cambiato e lascia stare i
# volumi. Niente `down -v` e niente prune: non viene eliminato nulla.
echo "==> Riavvio dei container (i volumi pgdata e storage NON vengono toccati)…"
"${DC[@]}" up -d

echo "==> Stato dei servizi:"
"${DC[@]}" ps

echo
echo "✓ Aggiornamento completato."
echo "  Log in tempo reale:  ${DC[*]} logs -f web worker"
