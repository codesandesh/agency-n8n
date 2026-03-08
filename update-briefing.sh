#!/bin/bash
set -e

WORKFLOW_FILE="agentic_ai_briefing.json"
CONTAINER_NAME="n8n-main"
DB_CONTAINER="n8n-postgres"
DB_NAME="n8n"
DB_USER="n8n"

if [ ! -f "$WORKFLOW_FILE" ]; then
    echo "Error: Workflow file '$WORKFLOW_FILE' not found."
    exit 1
fi

echo "[1/4] Copying '$WORKFLOW_FILE' to container..."
docker cp "$WORKFLOW_FILE" "$CONTAINER_NAME:/tmp/$WORKFLOW_FILE"

echo "[2/4] Syncing workflow..."
docker exec "$CONTAINER_NAME" n8n import:workflow --input="/tmp/$WORKFLOW_FILE"

echo "[3/4] Cleaning up temp file..."
docker exec "$CONTAINER_NAME" rm "/tmp/$WORKFLOW_FILE"

echo "[4/4] Fixing updatedAt timestamp to now..."
docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" \
    -c "UPDATE workflow_entity SET \"updatedAt\" = NOW();"

echo ""
echo "Workflow synced successfully at $(date '+%Y-%m-%d %H:%M:%S %Z')"
