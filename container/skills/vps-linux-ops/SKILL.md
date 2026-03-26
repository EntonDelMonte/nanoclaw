---
name: vps-linux-ops
description: VPS setup and hardening (Ubuntu/Debian), Nginx/Caddy with SSL, PM2 and systemd process management, Docker Compose deployment, log rotation, and automated backups. Concrete commands for production Linux servers.
allowed-tools: Bash, Read, Write, Edit
---

# VPS Linux Operations

Production Ubuntu/Debian VPS setup from bare metal to running app. All commands run on the server via SSH.

---

## 1. Initial Server Hardening

### First login as root
```bash
# Create non-root sudo user
adduser deploy
usermod -aG sudo deploy

# Copy root's authorized_keys to new user
mkdir -p /home/deploy/.ssh
cp ~/.ssh/authorized_keys /home/deploy/.ssh/
chown -R deploy:deploy /home/deploy/.ssh
chmod 700 /home/deploy/.ssh && chmod 600 /home/deploy/.ssh/authorized_keys
```

### SSH hardening (/etc/ssh/sshd_config)
```
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
Port 2222           # change default port (optional but reduces noise)
AllowUsers deploy
```
```bash
systemctl restart sshd
```

### UFW Firewall
```bash
ufw default deny incoming
ufw default allow outgoing
ufw allow 2222/tcp   # SSH (match your sshd Port)
ufw allow 80/tcp     # HTTP
ufw allow 443/tcp    # HTTPS
ufw enable
ufw status verbose
```

### fail2ban (brute-force protection)
```bash
apt install fail2ban -y
cp /etc/fail2ban/jail.conf /etc/fail2ban/jail.local
```

Edit `/etc/fail2ban/jail.local`:
```ini
[sshd]
enabled = true
port    = 2222
maxretry = 3
bantime = 3600
findtime = 600
```
```bash
systemctl enable fail2ban && systemctl start fail2ban
fail2ban-client status sshd  # verify
```

### System updates
```bash
apt update && apt upgrade -y
apt install -y curl git unzip htop ufw fail2ban
# Auto security updates:
apt install unattended-upgrades -y
dpkg-reconfigure --priority=low unattended-upgrades
```

---

## 2. Nginx with SSL (Let's Encrypt)

```bash
apt install nginx certbot python3-certbot-nginx -y
systemctl enable nginx
```

### Initial site config: `/etc/nginx/sites-available/myapp`
```nginx
server {
    listen 80;
    server_name example.com www.example.com;
    location / { return 301 https://$host$request_uri; }
}

server {
    listen 443 ssl http2;
    server_name example.com www.example.com;

    # SSL — certbot fills these in
    ssl_certificate /etc/letsencrypt/live/example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/example.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
ln -s /etc/nginx/sites-available/myapp /etc/nginx/sites-enabled/
nginx -t   # test config
certbot --nginx -d example.com -d www.example.com
systemctl reload nginx

# Auto-renewal (certbot installs a systemd timer, verify):
systemctl list-timers | grep certbot
certbot renew --dry-run
```

---

## 2B. Caddy (Simpler Alternative — Auto SSL)

```bash
apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
apt update && apt install caddy -y
```

`/etc/caddy/Caddyfile`:
```
example.com {
    reverse_proxy localhost:3000
    encode gzip
    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains"
        X-Frame-Options SAMEORIGIN
        X-Content-Type-Options nosniff
    }
}
```
```bash
systemctl enable caddy && systemctl start caddy
# Caddy handles SSL/TLS automatically via Let's Encrypt
```

---

## 3. PM2 (Node.js Process Management)

```bash
npm install -g pm2

# Start app
pm2 start npm --name "myapp" -- start

# Cluster mode (use all CPU cores)
pm2 start ecosystem.config.js
```

`ecosystem.config.js`:
```js
module.exports = {
  apps: [{
    name: 'myapp',
    script: 'npm',
    args: 'start',
    instances: 'max',          // cluster mode
    exec_mode: 'cluster',
    env: { NODE_ENV: 'production', PORT: 3000 },
    max_memory_restart: '500M',
    out_file: '/var/log/myapp/out.log',
    error_file: '/var/log/myapp/error.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
  }]
}
```

```bash
pm2 save                          # save process list
pm2 startup                       # generate startup script (run the output command)

# Deploy without downtime
pm2 reload myapp                  # graceful reload (0 downtime for cluster mode)
pm2 restart myapp                 # hard restart

# Monitoring
pm2 status
pm2 logs myapp --lines 100
pm2 monit                         # live CPU/memory dashboard
```

---

## 4. Docker Compose Deployment

```bash
apt install docker.io docker-compose-plugin -y
usermod -aG docker deploy          # allow deploy user to run docker
newgrp docker                      # activate (or re-login)
```

`docker-compose.yml`:
```yaml
version: '3.8'
services:
  app:
    image: ghcr.io/mnemclaw/myapp:latest
    restart: unless-stopped
    ports:
      - "127.0.0.1:3000:3000"    # bind to loopback only (Nginx proxies)
    environment:
      - NODE_ENV=production
    env_file: .env.production
    volumes:
      - app_data:/app/data
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: myapp
      POSTGRES_USER: myapp
      POSTGRES_PASSWORD_FILE: /run/secrets/db_password
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  app_data:
  postgres_data:
```

```bash
# Pull and start
docker compose pull
docker compose up -d

# Logs
docker compose logs -f app

# Update (zero-downtime with rolling, see deploy-go-live skill)
docker compose pull app && docker compose up -d --no-deps app
```

---

## 5. Log Management

```bash
# journalctl — systemd logs
journalctl -u nginx --since today
journalctl -u myapp -f              # follow
journalctl --disk-usage
journalctl --vacuum-time=30d        # remove logs older than 30 days
```

### logrotate for app logs
`/etc/logrotate.d/myapp`:
```
/var/log/myapp/*.log {
    daily
    rotate 14
    compress
    delaycompress
    missingok
    notifempty
    postrotate
        pm2 reloadLogs
    endscript
}
```

### /etc/systemd/journald.conf (limit journal size)
```ini
[Journal]
SystemMaxUse=500M
MaxRetentionSec=30day
```
```bash
systemctl restart systemd-journald
```

---

## 6. Automated Backups

### PostgreSQL backup via cron
```bash
# /usr/local/bin/backup-db.sh
#!/bin/bash
set -e
BACKUP_DIR="/backups/postgres"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p "$BACKUP_DIR"

pg_dump -U myapp -d myapp | gzip > "$BACKUP_DIR/myapp_$DATE.sql.gz"

# Keep last 30 days
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +30 -delete
```

```bash
chmod +x /usr/local/bin/backup-db.sh

# crontab -e (run as deploy user or postgres)
0 3 * * * /usr/local/bin/backup-db.sh >> /var/log/backup.log 2>&1
```

### Upload backups to S3/R2 (optional)
```bash
apt install awscli -y
aws configure   # or set AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY in environment

# Add to backup script:
aws s3 cp "$BACKUP_DIR/myapp_$DATE.sql.gz" s3://my-backup-bucket/postgres/
```

---

## Quick Diagnostics

```bash
# System resources
htop                              # interactive process viewer
df -h                             # disk usage
free -h                           # memory usage
ss -tlnp                          # listening ports

# Check if port is in use
ss -tlnp | grep 3000

# Test nginx config
nginx -t && systemctl reload nginx

# Check SSL cert expiry
echo | openssl s_client -servername example.com -connect example.com:443 2>/dev/null | openssl x509 -noout -dates

# Recent auth failures (fail2ban / sshd)
journalctl -u sshd | grep "Failed" | tail -20
fail2ban-client status sshd
```
