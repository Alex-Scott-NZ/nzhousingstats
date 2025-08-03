#!/bin/bash
set -e

echo "🚀 Deploying nzhousingstats… $(date)"

# Load NVM and switch Node version
echo "📌 Loading Node.js..."
source ~/.nvm/nvm.sh
nvm use 22.14.0

# Enable pnpm
echo "📌 Enabling pnpm..."
corepack enable
corepack prepare pnpm@latest --activate

# Verify tools
echo "🔍 Node: $(node --version)"
echo "🔍 pnpm: $(pnpm --version)"

# Load environment variables
if [ -f .env.production ]; then
  source .env.production
fi

# Pull latest
echo "⬇️ git pull origin main"
git pull origin main

# Install dependencies
echo "📦 pnpm install"
pnpm install --frozen-lockfile

# Build
echo "🔨 pnpm build"
pnpm build

# Reload via PM2
echo "🔄 pm2 reload nzhousingstats"
/home/madebyalex/.npm-global/bin/pm2 reload ecosystem.config.cjs --only nzhousingstats \
  || /home/madebyalex/.npm-global/bin/pm2 start ecosystem.config.cjs --only nzhousingstats

# Show status
echo "📊 PM2 Status:"
/home/madebyalex/.npm-global/bin/pm2 status nzhousingstats

# Optional: Purge Cloudflare cache
if [ -n "$CF_ZONE_ID" ] && [ -n "$CF_API_TOKEN" ]; then
  echo "🌐 Purging Cloudflare cache…"
  curl -s -X POST "https://api.cloudflare.com/client/v4/zones/$CF_ZONE_ID/purge_cache" \
    -H "Authorization: Bearer $CF_API_TOKEN" \
    -H "Content-Type: application/json" \
    --data '{"purge_everything":true}' > /dev/null
  echo "✅ Cloudflare cache purged"
fi

echo "✅ Deployment complete: $(date)"
