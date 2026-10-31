#!/usr/bin/env bash
# Backend para las pruebas E2E (T-AUTH-QA-01). Requiere PostgreSQL y Mailpit de
# `finora-back/compose.yaml` en marcha. Usa una base de datos propia, `finora_e2e`, que se
# recrea en cada corrida: la de desarrollo no se toca.
set -euo pipefail

cd "$(dirname "$0")/../../finora-back"

ADMIN_URL="${FINORA_E2E_ADMIN_URL:-postgresql://finora:finora@localhost:5432/finora}"
export FINORA_DATABASE_URL="${ADMIN_URL/postgresql:/postgresql+psycopg:}_e2e"

ADMIN_URL="$ADMIN_URL" uv run python - <<'PY'
import os

import psycopg

with psycopg.connect(os.environ["ADMIN_URL"], autocommit=True) as conn:
    conn.execute("DROP DATABASE IF EXISTS finora_e2e WITH (FORCE)")
    conn.execute("CREATE DATABASE finora_e2e")
PY

uv run alembic upgrade head
exec uv run uvicorn finora.main:app --host 127.0.0.1 --port "${FINORA_E2E_API_PORT:-8001}"
