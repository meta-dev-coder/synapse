#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Scenario Lab — launch backend + frontend
#
# Usage:
#   ./start.sh          # start both servers
#   ./start.sh --stop   # kill any running instances on the default ports
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

BACKEND_PORT=8000
FRONTEND_PORT=5173

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"
FRONTEND_DIR="$SCRIPT_DIR/frontend"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

# ── Stop mode ─────────────────────────────────────────────────────────────────
if [[ "${1:-}" == "--stop" ]]; then
  echo -e "${YELLOW}Stopping Scenario Lab servers…${RESET}"
  lsof -ti tcp:$BACKEND_PORT  | xargs kill -9 2>/dev/null && echo -e "  ${GREEN}✓ Backend (port $BACKEND_PORT) stopped${RESET}" || echo -e "  Backend not running"
  lsof -ti tcp:$FRONTEND_PORT | xargs kill -9 2>/dev/null && echo -e "  ${GREEN}✓ Frontend (port $FRONTEND_PORT) stopped${RESET}" || echo -e "  Frontend not running"
  exit 0
fi

# ── Port availability check ───────────────────────────────────────────────────
for PORT in $BACKEND_PORT $FRONTEND_PORT; do
  if lsof -ti tcp:$PORT &>/dev/null; then
    echo -e "${RED}Error: port $PORT is already in use.${RESET}"
    echo -e "  Run ${BOLD}./start.sh --stop${RESET} to clear existing instances."
    exit 1
  fi
done

# ── Python virtual environment ────────────────────────────────────────────────
VENV_DIR="$BACKEND_DIR/.venv"

if [[ ! -d "$VENV_DIR" ]]; then
  echo -e "${CYAN}Creating Python virtual environment…${RESET}"
  python3 -m venv "$VENV_DIR"
fi

source "$VENV_DIR/bin/activate"

echo -e "${CYAN}Installing/verifying backend dependencies…${RESET}"
pip install -q -r "$BACKEND_DIR/requirements.txt"

# ── Node modules ───────────────────────────────────────────────────────────────
if [[ ! -d "$FRONTEND_DIR/node_modules" ]]; then
  echo -e "${CYAN}Installing frontend dependencies (npm install)…${RESET}"
  cd "$FRONTEND_DIR" && npm install
fi

# ── GPS data preprocessing (one-time setup) ──────────────────────────────────
GPS_JSON="$BACKEND_DIR/datasets/bus_positions_sample.json"
if [[ ! -f "$GPS_JSON" ]]; then
  echo -e "${CYAN}Preprocessing GPS data (one-time setup, may take ~30s)…${RESET}"
  cd "$BACKEND_DIR"
  python scripts/preprocess_gps.py && echo -e "  ${GREEN}✓ GPS sample data ready${RESET}" || echo -e "  ${YELLOW}⚠ GPS preprocessing failed — replay will be unavailable${RESET}"
fi

# ── Log files ─────────────────────────────────────────────────────────────────
LOG_DIR="$SCRIPT_DIR/.logs"
mkdir -p "$LOG_DIR"
BACKEND_LOG="$LOG_DIR/backend.log"
FRONTEND_LOG="$LOG_DIR/frontend.log"

# ── Launch backend ─────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}Starting Scenario Lab${RESET}"
echo -e "────────────────────────────────"

cd "$BACKEND_DIR"
uvicorn app.main:app --host 0.0.0.0 --port $BACKEND_PORT --reload \
  > "$BACKEND_LOG" 2>&1 &
BACKEND_PID=$!
echo -e "  ${GREEN}✓ Backend${RESET}  http://localhost:$BACKEND_PORT  (PID $BACKEND_PID)"
echo -e "    Docs:    http://localhost:$BACKEND_PORT/docs"
echo -e "    Log:     $BACKEND_LOG"

# ── Launch frontend ────────────────────────────────────────────────────────────
cd "$FRONTEND_DIR"
npm run dev -- --port $FRONTEND_PORT \
  > "$FRONTEND_LOG" 2>&1 &
FRONTEND_PID=$!
echo -e "  ${GREEN}✓ Frontend${RESET} http://localhost:$FRONTEND_PORT  (PID $FRONTEND_PID)"
echo -e "    Log:     $FRONTEND_LOG"

echo ""
echo -e "Press ${BOLD}Ctrl+C${RESET} to stop both servers."
echo ""

# ── Cleanup on exit ────────────────────────────────────────────────────────────
cleanup() {
  echo ""
  echo -e "${YELLOW}Shutting down…${RESET}"
  kill $BACKEND_PID  2>/dev/null || true
  kill $FRONTEND_PID 2>/dev/null || true
  echo -e "${GREEN}Done.${RESET}"
}
trap cleanup INT TERM

# ── Wait and tail logs ─────────────────────────────────────────────────────────
sleep 1

# Verify both processes started
if ! kill -0 $BACKEND_PID 2>/dev/null; then
  echo -e "${RED}Backend failed to start. Check $BACKEND_LOG${RESET}"
  kill $FRONTEND_PID 2>/dev/null || true
  exit 1
fi
if ! kill -0 $FRONTEND_PID 2>/dev/null; then
  echo -e "${RED}Frontend failed to start. Check $FRONTEND_LOG${RESET}"
  kill $BACKEND_PID 2>/dev/null || true
  exit 1
fi

# Tail both logs together until Ctrl+C
tail -f "$BACKEND_LOG" "$FRONTEND_LOG" &
TAIL_PID=$!

wait $BACKEND_PID $FRONTEND_PID 2>/dev/null
kill $TAIL_PID 2>/dev/null || true
