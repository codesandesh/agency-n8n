#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# deploy.sh — One-shot EC2 setup for n8n stack with ngrok
# Run this once on a fresh Ubuntu 22.04 EC2 instance as the ubuntu user.
# ─────────────────────────────────────────────────────────────────────────────
set -e

REPO_DIR="$HOME/nepali-congress-n8n"
NGROK_DOMAIN="plumbaginous-technologically-burt.ngrok-free.dev"
NGROK_TOKEN="3AZYELioS7BK2Jc535vpDfMwjm1_btafqf9gxeKQYGjVPvmk"

echo "============================================"
echo " n8n EC2 Deployment Script (ngrok)"
echo "============================================"

# ── 1. System update ─────────────────────────────────────────────────────────
echo "[1/5] Updating system packages..."
sudo apt update -y && sudo apt upgrade -y

# ── 2. Install Docker ────────────────────────────────────────────────────────
echo "[2/5] Installing Docker..."
if ! command -v docker &>/dev/null; then
    curl -fsSL https://get.docker.com | sudo sh
    sudo usermod -aG docker "$USER"
    newgrp docker
else
    echo "  Docker already installed. Skipping."
fi

# ── 3. Install ngrok ─────────────────────────────────────────────────────────
echo "[3/5] Installing ngrok..."
if ! command -v ngrok &>/dev/null; then
    curl -sSL https://ngrok-agent.s3.amazonaws.com/ngrok.asc \
        | sudo tee /etc/apt/trusted.gpg.d/ngrok.asc >/dev/null
    echo "deb https://ngrok-agent.s3.amazonaws.com bookworm main" \
        | sudo tee /etc/apt/sources.list.d/ngrok.list
    sudo apt update && sudo apt install -y ngrok
else
    echo "  ngrok already installed. Skipping."
fi

# Add authtoken
ngrok config add-authtoken "$NGROK_TOKEN"
echo "  ngrok authtoken configured."

# ── 4. Start Docker stack ────────────────────────────────────────────────────
echo "[4/5] Starting Docker Compose stack..."
cd "$REPO_DIR"
docker compose up -d --build

echo "  Waiting 20s for containers to become healthy..."
sleep 20
docker compose ps

# ── 5. Import workflow ───────────────────────────────────────────────────────
echo "[5/5] Importing workflow..."
bash "$REPO_DIR/import-workflow.sh" "$REPO_DIR/agentic_ai_briefing.json"

echo ""
echo "============================================"
echo " Deployment complete!"
echo " Now run: bash start-ngrok.sh"
echo " n8n will be live at:"
echo "   https://$NGROK_DOMAIN"
echo "============================================"
