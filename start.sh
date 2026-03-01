#!/usr/bin/env bash
# Starts both the FastAPI backend and Vite frontend dev servers.
# Usage: ./start.sh

set -e
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ── Backend ───────────────────────────────────────────────────────────────────
echo "Starting FastAPI backend on http://localhost:8000 ..."
(
  cd "$ROOT/backend"
  source venv/bin/activate
  python run.py
) &
BACKEND_PID=$!

# ── Frontend ──────────────────────────────────────────────────────────────────
echo "Starting Vite frontend on http://localhost:5173 ..."
(
  cd "$ROOT/frontend"
  /opt/homebrew/bin/npm run dev
) &
FRONTEND_PID=$!

# ── Cleanup on Ctrl+C ─────────────────────────────────────────────────────────
trap "echo 'Stopping...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" INT TERM

echo ""
echo "Logora running:"
echo "  Frontend → http://localhost:5173"
echo "  Backend  → http://localhost:8000"
echo "  API docs → http://localhost:8000/docs"
echo ""
echo "Press Ctrl+C to stop."
wait
