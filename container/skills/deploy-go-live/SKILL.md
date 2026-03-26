---
name: deploy-go-live
description: CI/CD with GitHub Actions, environment/secrets management, DNS and Cloudflare setup, zero-downtime deploys, health checks with UptimeRobot, and Sentry error tracking. Full go-live checklist for SaaS/web apps.
allowed-tools: Bash, Read, Write, Edit, Glob
---

# Deployment & Go-Live

From code push to production. Covers CI/CD, secrets, DNS, zero-downtime deploys, and monitoring.

---

## GitHub Actions — CI/CD Pipeline

### Typical workflow: test → build → deploy

`.github/workflows/deploy.yml`:
```yaml
name: Deploy

on:
  push:
    branches: [main]

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm' }
      - run: npm ci
      - run: npm run lint
      - run: npm test

  build-push:
    needs: test
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v4
      - uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - uses: docker/metadata-action@v5
        id: meta
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
          tags: |
            type=sha,prefix=sha-
            type=raw,value=latest,enable={{is_default_branch}}
      - uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

  deploy:
    needs: build-push
    runs-on: ubuntu-latest
    environment: production
    steps:
      - name: Deploy to VPS
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.VPS_HOST }}
          username: deploy
          key: ${{ secrets.VPS_SSH_KEY }}
          script: |
            cd /opt/myapp
            docker compose pull app
            docker compose up -d --no-deps --wait app
            docker image prune -f
```

### Required GitHub secrets
```
VPS_HOST           — server IP or hostname
VPS_SSH_KEY        — private key for deploy user (cat ~/.ssh/id_ed25519)
```
Add via: Settings → Secrets and variables → Actions

---

## Environment Management

### .env file hierarchy
```
.env                    # defaults, committed to git (no secrets)
.env.local              # local overrides, gitignored
.env.production         # production values, gitignored, deployed manually or via secrets
.env.test               # test overrides, can be committed if no secrets
```

### Never commit secrets — .gitignore
```
.env.local
.env.production
.env*.local
*.pem
```

### Injecting secrets in CI
GitHub: Add secrets in repo Settings → Secrets → Actions, reference as `${{ secrets.MY_SECRET }}`

On VPS — write `.env.production` once, keep on server:
```bash
# On server (one-time setup)
cat > /opt/myapp/.env.production << 'EOF'
DATABASE_URL=postgresql://...
STRIPE_SECRET_KEY=sk_live_...
EOF
chmod 600 /opt/myapp/.env.production
```

Docker Compose uses it via `env_file: .env.production`

---

## DNS & Cloudflare Setup

### Minimal DNS records
```
Type    Name        Value                   TTL
A       @           203.0.113.1             Auto (Cloudflare proxied)
A       www         203.0.113.1             Auto (Cloudflare proxied)
CNAME   api         @                       Auto
MX      @           mail.example.com        Auto
TXT     @           v=spf1 include:...      Auto
```

### Cloudflare settings for a new app
1. Add site → change nameservers at registrar to Cloudflare NS
2. SSL/TLS mode: **Full (strict)** — requires valid cert on origin (use Let's Encrypt on VPS)
3. Enable **Always Use HTTPS** (SSL → Edge Certificates)
4. Enable **HSTS** (SSL → Edge Certificates → Enable HSTS)
5. Firewall: block bad bots (Security → Bots → Bot Fight Mode = ON)

TTL note: Cloudflare-proxied records show TTL=Auto (300s effective). During DNS migration, set non-proxied records to TTL=300 so changes propagate in 5 min.

### Check propagation
```bash
dig +short example.com A
nslookup example.com 8.8.8.8  # query via Google DNS
# Or: https://dnschecker.org
```

---

## Zero-Downtime Deploys

### Docker Compose rolling (single server)
```bash
# Pull new image, replace container — brief (< 5s) interruption
docker compose pull app && docker compose up -d --no-deps app
```

For true zero-downtime on a single server, run two containers behind Nginx upstream:
```nginx
upstream app {
    server 127.0.0.1:3000;
    server 127.0.0.1:3001 backup;  # bring up during deploy
}
```

### PM2 zero-downtime reload
```bash
# Graceful reload — PM2 starts new workers before killing old (cluster mode only)
pm2 reload myapp
```

### Blue-green basics (two servers)
```
Blue (current live) → Green (new version)
1. Deploy new version to Green server
2. Run smoke tests on Green
3. Point load balancer / Cloudflare DNS to Green
4. Keep Blue running for 10 min as rollback
5. After confirmation: decommission Blue or make it new standby
```

---

## Health Checks

### App health endpoint
```ts
// app/api/health/route.ts
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    await db.execute('SELECT 1')   // check DB
    return NextResponse.json({ status: 'ok', ts: Date.now() })
  } catch (err) {
    return NextResponse.json({ status: 'error', error: String(err) }, { status: 503 })
  }
}
```

### UptimeRobot (free tier, 5-min checks)
1. Create account at uptimerobot.com
2. Add monitor: type = HTTP(s), URL = `https://example.com/api/health`
3. Alert contacts: email + Telegram bot (copy webhook from UptimeRobot → Telegram notification)
4. Alert when down: 2 consecutive failures (10 min down before alert)

---

## Sentry Error Tracking

```bash
npm i @sentry/nextjs
npx @sentry/wizard@latest -i nextjs
```

This creates `sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`.

```ts
// sentry.server.config.ts
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  // Only track errors in production by default:
  enabled: process.env.NODE_ENV === 'production',
})
```

```
SENTRY_DSN=https://....ingest.sentry.io/...
SENTRY_ORG=your-org
SENTRY_PROJECT=your-project
SENTRY_AUTH_TOKEN=...      # for sourcemap upload in CI
```

Add to GitHub Actions (upload sourcemaps):
```yaml
- name: Build with Sentry
  run: npm run build
  env:
    SENTRY_AUTH_TOKEN: ${{ secrets.SENTRY_AUTH_TOKEN }}
```

Sentry alerts: Project Settings → Alerts → create rule:
- When: event seen more than 5 times in 1 hour
- Action: notify via email / Slack / PagerDuty

---

## Go-Live Checklist

### Before launch
- [ ] Environment variables set on production server
- [ ] STRIPE_WEBHOOK_SECRET registered at dashboard.stripe.com/webhooks (production endpoint)
- [ ] Database migrations run: `npm run db:migrate`
- [ ] SSL certificate valid: `curl -I https://example.com`
- [ ] Health endpoint returns 200: `curl https://example.com/api/health`
- [ ] Sentry connected and test event received
- [ ] UptimeRobot monitor active
- [ ] robots.txt allows crawlers (unless pre-launch)
- [ ] OG image renders at opengraph.xyz
- [ ] Google Search Console: submit sitemap
- [ ] Cloudflare SSL mode = Full (strict)

### Post-launch
- [ ] Stripe webhook tested (checkout.session.completed)
- [ ] Error rate in Sentry = 0 after 30 min
- [ ] UptimeRobot shows "Up" status
- [ ] Check Core Web Vitals: PageSpeed Insights
- [ ] Lighthouse SEO ≥ 90

---

## Rollback

```bash
# Docker — roll back to previous image tag
docker compose stop app
docker compose run --rm app  # verify new image works
# If broken:
docker tag ghcr.io/org/app:sha-<previous> ghcr.io/org/app:latest
docker compose up -d --no-deps app

# PM2 — check previous deploy
pm2 logs myapp --lines 50
pm2 restart myapp   # if just needs restart
# For code rollback: git revert + redeploy via CI
```
