#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# start-ngrok.sh — Start ngrok tunnel with your static domain
# Run this after deploy.sh, and every time you restart the EC2 instance.
# ─────────────────────────────────────────────────────────────────────────────

NGROK_DOMAIN="plumbaginous-technologically-burt.ngrok-free.dev"

# Kill any existing ngrok
pkill -f ngrok 2>/dev/null || true
sleep 1

echo "Starting ngrok tunnel..."
echo "  Domain : https://$NGROK_DOMAIN"
echo "  Target : localhost:5678 (n8n)"
echo ""

# Run ngrok with your static domain pointing to n8n
# Press Ctrl+C to stop. Run with 'nohup bash start-ngrok.sh &' to keep it in background.
ngrok http --domain="$NGROK_DOMAIN" 5678
