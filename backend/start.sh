#!/bin/sh
# Container entrypoint: apply DB schema/migrations + seed the catalog (idempotent),
# then serve the API. If init_db fails (e.g. DB briefly unreachable), still start
# the server so /health responds and the issue can be diagnosed.
python -m app.init_db || echo "WARNING: app.init_db failed — starting server anyway"
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}"
