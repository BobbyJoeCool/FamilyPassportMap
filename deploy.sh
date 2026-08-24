#!/usr/bin/env bash
# Deploy FamilyPassportMap to Azure App Service (Free F1 tier).
#
# Strategy: build locally, swap the root build script to a no-op so Oryx
# only runs `npm install` (compiling native modules like better-sqlite3
# for Linux), then restore the real script. The zip ships with pre-built
# dist/ directories so no TypeScript/Vite build runs on Azure.
set -euo pipefail

APP_NAME="family-passport-map"
RESOURCE_GROUP="family_passport_app_rg"
ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
ZIP_PATH="/tmp/familypassportmap-deploy.zip"

echo "==> Building project locally..."
cd "$ROOT_DIR"
npm run build

echo "==> Creating deployment zip (no-op build script for Oryx)..."
rm -f "$ZIP_PATH"

# Temporarily swap the build script so Oryx skips the TS/Vite build on Azure.
cp package.json package.json.bak
python3 -c "
import json
with open('package.json') as f:
    pkg = json.load(f)
pkg['scripts']['build'] = 'echo Build skipped - pre-built artifacts in zip'
with open('package.json', 'w') as f:
    json.dump(pkg, f, indent=2)
    f.write('\n')
"

cd "$ROOT_DIR"
zip -r "$ZIP_PATH" . \
  -x "*/node_modules/*" \
  -x "node_modules/*" \
  -x ".git/*" \
  -x "DevNotes/*" \
  -x ".DS_Store" \
  -x ".claude/*" \
  -x ".vscode/*" \
  -x "*.env" \
  -x "apps/server/data/*" \
  -x "apps/server/prisma/*.db*" \
  -x "package.json.bak" \
  > /dev/null

# Restore the real build script immediately.
cp package.json.bak package.json && rm package.json.bak

echo "    Zip size: $(du -sh "$ZIP_PATH" | cut -f1)"

echo "==> Deploying to Azure (${APP_NAME}) via ZipDeploy..."
az webapp deployment source config-zip \
  --name "$APP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --src "$ZIP_PATH"

echo ""
echo "==> Done. Site: https://${APP_NAME}.azurewebsites.net"
