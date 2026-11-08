#!/usr/bin/env bash
# Pornire rapidă pe macOS / Linux: ./start.sh
set -e
cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js lipsește. Instalează de la https://nodejs.org (LTS), apoi rulează din nou."
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "Prima pornire: instalez componentele..."
  npm install
fi

if [ ! -f .env ]; then
  cp .env.example .env
  echo ""
  echo "Am creat .env. Completează MC_HOST, MC_OWNER și LLM_API_KEY, apoi rulează din nou."
  echo "Editor: nano .env"
  exit 0
fi

npm start
