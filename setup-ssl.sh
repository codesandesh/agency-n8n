#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# setup-ssl.sh — Install Certbot and get a Let's Encrypt SSL cert for n8n
# Run AFTER deploy.sh and AFTER your domain DNS A record points to this EC2 IP.
# ─────────────────────────────────────────────────────────────────────────────
set -e

# ── Read domain from .env ────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/.env"

if [ ! -f "$ENV_FILE" ]; then
    echo "ERROR: .env file not found at $ENV_FILE"
    exit 1
fi

DOMAIN=$(grep '^N8N_HOST=' "$ENV_FILE" | cut -d= -f2 | tr -d '"' | tr -d "'")

if [ -z "$DOMAIN" ] || [ "$DOMAIN" = "YOUR_DOMAIN_HERE" ]; then
    echo "ERROR: Set N8N_HOST in your .env file before running this script."
    echo "  Example: N8N_HOST=n8n.yourdomain.com"
    exit 1
fi

echo "============================================"
echo " Setting up SSL for: $DOMAIN"
echo "============================================"

# ── 1. Install Certbot ───────────────────────────────────────────────────────
echo "[1/3] Installing Certbot..."
if ! command -v certbot &>/dev/null; then
    sudo apt update -y
    sudo apt install -y certbot python3-certbot-nginx
else
    echo "  Certbot already installed. Skipping."
fi

# ── 2. Obtain cert and auto-configure Nginx ──────────────────────────────────
echo "[2/3] Obtaining SSL certificate for $DOMAIN..."
sudo certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --register-unsafely-without-email

# ── 3. Test auto-renewal ─────────────────────────────────────────────────────
echo "[3/3] Testing auto-renewal..."
sudo certbot renew --dry-run

echo ""
echo "============================================"
echo " SSL setup complete!"
echo " n8n is now available at: https://$DOMAIN"
echo " Cert auto-renews via certbot systemd timer."
echo "============================================"
