#!/bin/sh
# Rebuild and (re)start the preview server used for capture and E2E probing.
set -e
cd "$(dirname "$0")/.."
npm run build >/dev/null
# The bracket keeps the pattern from matching this script's own command line.
pkill -f "vite[ ]preview" 2>/dev/null || true
sleep 1
nohup npx vite preview --port 4173 --host 127.0.0.1 >/dev/null 2>&1 &
sleep 3
curl -sf -o /dev/null http://127.0.0.1:4173/ && echo "preview ready"
