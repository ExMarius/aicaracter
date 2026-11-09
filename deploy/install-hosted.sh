#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
#  Instalare Gicu pe o găzduire Linux (VPS, panou cu egg Node.js,
#  Raspberry Pi, laptop vechi). Rulează din folderul proiectului:
#
#     bash deploy/install-hosted.sh
# ─────────────────────────────────────────────────────────────
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT="$(pwd)"

GREEN='\033[0;32m'; YELLOW='\033[0;33m'; RED='\033[0;31m'; DIM='\033[0;90m'; NC='\033[0m'
ok()   { echo -e "${GREEN}✓${NC} $*"; }
warn() { echo -e "${YELLOW}!${NC} $*"; }
err()  { echo -e "${RED}✗${NC} $*"; }
dim()  { echo -e "${DIM}$*${NC}"; }

echo -e "\n🤖 Instalare GICU pe găzduire\n"

# ── 1. Node.js ──────────────────────────────────────────────
if ! command -v node >/dev/null 2>&1; then
  err "Node.js lipsește."
  echo "  Instalează-l cu:"
  echo "    curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -"
  echo "    sudo apt install -y nodejs"
  exit 1
fi
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
if [ "$NODE_MAJOR" -lt 20 ]; then
  err "Ai Node.js $(node -v). Îți trebuie 20 sau mai nou."
  exit 1
fi
ok "Node.js $(node -v)"

# ── 2. Dependințe ───────────────────────────────────────────
if [ ! -d node_modules ]; then
  echo "→ Instalez dependințele (1-2 minute)..."
  npm install --no-audit --no-fund
fi
ok "Dependințe instalate"

# ── 3. Configurare ──────────────────────────────────────────
if [ ! -f .env ]; then
  if [ -t 0 ]; then
    echo ""
    echo "Completează (Enter = valoarea din paranteze):"
    read -r -p "  Adresa serverului MC [localhost]: " MC_HOST; MC_HOST="${MC_HOST:-localhost}"
    read -r -p "  Portul serverului MC [25565]: " MC_PORT; MC_PORT="${MC_PORT:-25565}"
    read -r -p "  Numele botului [Gicu]: " MC_USERNAME; MC_USERNAME="${MC_USERNAME:-Gicu}"
    read -r -p "  Numele tău din joc: " MC_OWNER
    MC_OWNER="${MC_OWNER:-ExMarius}"
    read -r -p "  Versiunea serverului (auto dacă nu știi) [auto]: " MC_VERSION; MC_VERSION="${MC_VERSION:-auto}"
    read -r -p "  Server premium? online-mode=true (d/n) [n]: " PREMIUM
    AUTH="offline"; [ "${PREMIUM,,}" = "d" ] && AUTH="microsoft"
    read -r -p "  LLM_API_KEY (Enter = fără AI, doar reguli): " LLM_KEY
    read -r -p "  LLM_BASE_URL [https://api.openai.com/v1]: " LLM_URL
    LLM_URL="${LLM_URL:-https://api.openai.com/v1}"
    read -r -p "  LLM_MODEL [gpt-4o-mini]: " LLM_MODEL; LLM_MODEL="${LLM_MODEL:-gpt-4o-mini}"

    cat > .env <<EOF
# Generat de deploy/install-hosted.sh
MC_HOST=$MC_HOST
MC_PORT=$MC_PORT
MC_VERSION=$MC_VERSION
MC_USERNAME=$MC_USERNAME
MC_AUTH=$AUTH
MC_OWNER=$MC_OWNER
MC_ALLOW_ALL_PLAYERS=false

LLM_BASE_URL=$LLM_URL
LLM_API_KEY=$LLM_KEY
LLM_MODEL=$LLM_MODEL
LLM_MODE=tools

# Fără sunet pe găzduire (nu are boxe) — vocea se aude doar local
TTS_ENABLED=false
REACTIONS_ENABLED=true
IDLE_CHAT_SECONDS=240
LOG_LEVEL=info
EOF
    chmod 600 .env
    ok "Am creat .env"
  else
    cp .env.example .env
    sed -i 's/^TTS_ENABLED=true/TTS_ENABLED=false/' .env
    warn "Am creat .env din exemplu — completează MC_HOST, MC_OWNER și LLM_API_KEY."
  fi
else
  ok "Am găsit .env existent"
fi

# ── 4. Test live ────────────────────────────────────────────
echo ""
read -r -p "Testez acum conexiunea la server? (d/n) [d]: " DO_TEST
if [ "${DO_TEST:-d}" != "n" ]; then
  node scripts/live-check.js || warn "Testul a eșuat — vezi mesajele de mai sus."
fi

# ── 5. Pornire ──────────────────────────────────────────────
echo ""
echo "Cum vrei să ruleze de acum încolo?"
echo "  1) systemd (recomandat pe VPS) — pornește singur la boot, repornește la crash"
echo "  2) pm2 (dacă îl ai deja)"
echo "  3) doar acum, în premieră (nohup)"
read -r -p "Alege 1/2/3 [1]: " MODE; MODE="${MODE:-1}"

if [ "$MODE" = "1" ]; then
  if command -v systemctl >/dev/null 2>&1; then
    SERVICE=/etc/systemd/system/gicu.service
    sudo tee "$SERVICE" >/dev/null <<EOF
[Unit]
Description=GICU - personaj AI pentru Minecraft
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$ROOT
Environment=NODE_ENV=production
ExecStart=$(command -v node) src/index.js
Restart=always
RestartSec=10
StandardOutput=append:$ROOT/logs/hosted.log
StandardError=append:$ROOT/logs/hosted.log

[Install]
WantedBy=multi-user.target
EOF
    sudo systemctl daemon-reload
    sudo systemctl enable --now gicu
    ok "Serviciu systemd pornit. Status:  sudo systemctl status gicu"
    dim "   Loguri live:  tail -f $ROOT/logs/hosted.log"
  else
    warn "systemd nu e disponibil aici. Pornesc cu nohup."
    MODE=3
  fi
fi

if [ "$MODE" = "2" ]; then
  if command -v pm2 >/dev/null 2>&1; then
    pm2 start src/index.js --name gicu --time
    pm2 save
    ok "Pornit cu pm2. Loguri:  pm2 logs gicu"
  else
    warn "pm2 nu e instalat (npm i -g pm2). Pornesc cu nohup."
    MODE=3
  fi
fi

if [ "$MODE" = "3" ]; then
  mkdir -p logs
  nohup node src/index.js >> logs/hosted.log 2>&1 &
  echo $! > logs/gicu.pid
  ok "Pornit în fundal (PID $(cat logs/gicu.pid))."
  dim "   Loguri:  tail -f logs/hosted.log"
  dim "   Oprire:  kill \$(cat logs/gicu.pid)"
fi

echo ""
ok "Gata. Gicu ar trebui să intre pe server în câteva secunde."
dim "   Nu uita: pe găzduire vocea e oprită (nu există boxe). Pentru filmare rulează local."
echo ""
