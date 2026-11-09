#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
#  Pregătește un VPS mic (Ubuntu/Debian) pentru Gicu:
#  Node.js 22, swap (dacă ai puțină RAM), clonează proiectul,
#  apoi pornește instalarea interactivă.
#
#     bash deploy/setup-vps.sh
#     bash deploy/setup-vps.sh --dir /opt/aicaracter
#     bash deploy/setup-vps.sh --no-swap
# ─────────────────────────────────────────────────────────────
set -euo pipefail

REPO_URL="https://github.com/ExMarius/aicaracter.git"
TARGET_DIR="$HOME/aicaracter"
DO_SWAP=1

while [ $# -gt 0 ]; do
  case "$1" in
    --dir) TARGET_DIR="${2:?}"; shift 2 ;;
    --no-swap) DO_SWAP=0; shift ;;
    -h|--help)
      echo "Utilizare: bash deploy/setup-vps.sh [--dir CALE] [--no-swap]"
      exit 0 ;;
    *) echo "Opțiune necunoscută: $1"; exit 1 ;;
  esac
done

GREEN='\033[0;32m'; YELLOW='\033[0;33m'; RED='\033[0;31m'; DIM='\033[0;90m'; NC='\033[0m'
ok()   { echo -e "${GREEN}✓${NC} $*"; }
warn() { echo -e "${YELLOW}!${NC} $*"; }
err()  { echo -e "${RED}✗${NC} $*"; }
dim()  { echo -e "${DIM}$*${NC}"; }

if [ "$(id -u)" -eq 0 ]; then SUDO=""; else
  command -v sudo >/dev/null 2>&1 || { err "Am nevoie de root sau sudo."; exit 1; }
  SUDO="sudo"
fi

echo -e "\n🖥  Pregătire VPS pentru GICU\n"

# ── 1. Sistem ───────────────────────────────────────────────
if command -v apt-get >/dev/null 2>&1; then
  $SUDO apt-get update -qq
  $SUDO apt-get install -y -qq curl git ca-certificates >/dev/null
  ok "Pachete de bază (curl, git)"
else
  warn "Nu e un sistem cu apt (Debian/Ubuntu). Continui, dar instalează tu Node 20+ și git."
fi

# ── 2. Node.js ≥ 20 ─────────────────────────────────────────
NEED_NODE=1
if command -v node >/dev/null 2>&1; then
  MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
  [ "$MAJOR" -ge 20 ] && NEED_NODE=0
fi

if [ "$NEED_NODE" -eq 1 ]; then
  echo "→ Instalez Node.js 22..."
  if command -v apt-get >/dev/null 2>&1; then
    curl -fsSL https://deb.nodesource.com/setup_22.x | $SUDO -E bash - >/dev/null
    $SUDO apt-get install -y -qq nodejs >/dev/null
  else
    err "Instalează manual Node.js 20+ de la https://nodejs.org și rulează din nou."
    exit 1
  fi
fi
ok "Node.js $(node -v)"

# ── 3. Swap (util la 1 GB RAM) ──────────────────────────────
MEM_MB=$(awk '/MemTotal/ {printf "%d", $2/1024}' /proc/meminfo)
SWAP_MB=$(awk '/SwapTotal/ {printf "%d", $2/1024}' /proc/meminfo)
if [ "$DO_SWAP" -eq 1 ] && [ "$SWAP_MB" -lt 256 ]; then
  if [ ! -f /swapfile ]; then
    echo "→ Creez 1 GB de swap (ajută la vârfurile de memorie)..."
    $SUDO fallocate -l 1G /swapfile 2>/dev/null || $SUDO dd if=/dev/zero of=/swapfile bs=1M count=1024 status=none
    $SUDO chmod 600 /swapfile
    $SUDO mkswap /swapfile >/dev/null
    $SUDO swapon /swapfile
    grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' | $SUDO tee -a /etc/fstab >/dev/null
    ok "Swap 1 GB activ"
  else
    warn "/swapfile există dar e inactiv — îl activez."
    $SUDO swapon /swapfile || true
  fi
else
  dim "   RAM: ${MEM_MB} MB, swap: ${SWAP_MB} MB (nu mai e nevoie de swap)"
fi

# ── 4. Proiectul ────────────────────────────────────────────
if [ -d "$TARGET_DIR/.git" ]; then
  echo "→ Actualizez proiectul existent din $TARGET_DIR"
  git -C "$TARGET_DIR" pull --ff-only || warn "Nu am putut face pull (modificări locale?). Continui cu ce e acolo."
else
  echo "→ Descarc proiectul în $TARGET_DIR"
  mkdir -p "$(dirname "$TARGET_DIR")"
  git clone --depth 1 "$REPO_URL" "$TARGET_DIR"
fi
ok "Proiect în $TARGET_DIR"

# ── 5. Instalare interactivă ────────────────────────────────
cd "$TARGET_DIR"
if [ -t 0 ]; then
  bash deploy/install-hosted.sh
else
  warn "Fără terminal interactiv: instalez dependințele și îți las .env de completat."
  npm install --no-audit --no-fund
  [ -f .env ] || { cp .env.example .env; sed -i 's/^TTS_ENABLED=true/TTS_ENABLED=false/' .env; }
  echo ""
  echo "Completează:  nano $TARGET_DIR/.env"
  echo "Apoi:         bash $TARGET_DIR/deploy/install-hosted.sh"
fi
