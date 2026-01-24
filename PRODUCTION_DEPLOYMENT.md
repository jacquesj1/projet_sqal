# Production Deployment Guide - Système Gaveurs V3.0

Complete guide for deploying the Gaveurs system to production with Docker Compose.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Initial Setup](#initial-setup)
3. [Configuration](#configuration)
4. [SSL Certificates](#ssl-certificates)
5. [Deployment](#deployment)
6. [Monitoring](#monitoring)
7. [Backup & Recovery](#backup--recovery)
8. [Maintenance](#maintenance)
9. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### System Requirements

- **CPU**: 8+ cores recommended (minimum 4 cores)
- **RAM**: 32GB recommended (minimum 16GB)
- **Disk**: 500GB SSD (for database, logs, backups)
- **OS**: Ubuntu 22.04 LTS or Debian 11+ (recommended)
- **Docker**: 24.0+ with Docker Compose v2

### Installation

```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo apt-get update
sudo apt-get install docker-compose-plugin

# Verify installation
docker --version
docker compose version
```

### Network Requirements

- **Inbound ports**: 80 (HTTP), 443 (HTTPS)
- **Optional**: 22 (SSH for management)
- **Firewall**: Configure UFW or iptables
- **DNS**: Configure A records for all subdomains

---

## Initial Setup

### 1. Clone Repository

```bash
cd /opt
git clone <repository-url> gaveurs
cd gaveurs
```

### 2. Create Data Directories

```bash
sudo mkdir -p /opt/gaveurs/data/{timescaledb,backups,logs/{backend,nginx}}
sudo chown -R 1000:1000 /opt/gaveurs/data
```

### 3. Set Permissions

```bash
chmod 700 /opt/gaveurs/data
chmod 755 /opt/gaveurs/data/logs
```

---

## Configuration

### 1. Environment Variables

Copy the template and configure:

```bash
cp .env.production.template .env.production
nano .env.production
```

**Critical settings to change:**

```bash
# Database
DATABASE_PASSWORD=<generate-strong-password>

# Redis
REDIS_PASSWORD=<generate-strong-password>

# Application Security
SECRET_KEY=<use: openssl rand -hex 32>
JWT_SECRET_KEY=<use: openssl rand -hex 32>

# Domain Configuration
DOMAIN=your-domain.com
API_DOMAIN=api.your-domain.com
EURALIS_DOMAIN=euralis.your-domain.com
GAVEURS_DOMAIN=gaveurs.your-domain.com
SQAL_DOMAIN=sqal.your-domain.com
MONITORING_DOMAIN=monitoring.your-domain.com

# SSL
LETSENCRYPT_EMAIL=admin@your-domain.com

# CORS
CORS_ORIGINS=https://your-domain.com,https://euralis.your-domain.com,https://gaveurs.your-domain.com,https://sqal.your-domain.com

# Frontend URLs
NEXT_PUBLIC_API_URL=https://api.your-domain.com
VITE_API_URL=https://api.your-domain.com
VITE_WS_URL=wss://api.your-domain.com

# Monitoring
GRAFANA_ADMIN_PASSWORD=<strong-password>
GRAFANA_SECRET_KEY=<use: openssl rand -hex 32>
GRAFANA_DB_PASSWORD=<strong-password>

# AlertManager
ALERTMANAGER_SLACK_WEBHOOK=https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK
ALERTMANAGER_EMAIL_TO=ops@your-domain.com
ALERTMANAGER_SMTP_PASSWORD=<smtp-password>

# Backup
BACKUP_S3_ACCESS_KEY=<aws-access-key>
BACKUP_S3_SECRET_KEY=<aws-secret-key>
```

### 2. Generate Passwords

```bash
# Generate secure passwords
openssl rand -base64 32  # Database password
openssl rand -base64 32  # Redis password
openssl rand -hex 32     # Secret keys
```

### 3. Nginx Configuration

Update nginx configurations with your domain names:

```bash
# Replace placeholders in nginx configs
export API_DOMAIN=api.your-domain.com
export EURALIS_DOMAIN=euralis.your-domain.com
export GAVEURS_DOMAIN=gaveurs.your-domain.com
export SQAL_DOMAIN=sqal.your-domain.com

# Use envsubst to replace variables
envsubst < docker/nginx/conf.d/api.conf.template > docker/nginx/conf.d/api.conf
envsubst < docker/nginx/conf.d/euralis.conf.template > docker/nginx/conf.d/euralis.conf
envsubst < docker/nginx/conf.d/gaveurs.conf.template > docker/nginx/conf.d/gaveurs.conf
envsubst < docker/nginx/conf.d/sqal.conf.template > docker/nginx/conf.d/sqal.conf
```

---

## SSL Certificates

### Option 1: Let's Encrypt (Recommended)

```bash
# 1. Start nginx without SSL first (for ACME challenge)
docker compose -f docker-compose.prod.yml up -d nginx-proxy

# 2. Obtain certificates
docker compose -f docker-compose.prod.yml run --rm certbot certonly \
  --webroot --webroot-path /var/www/certbot \
  --email admin@your-domain.com \
  --agree-tos --no-eff-email \
  -d your-domain.com \
  -d api.your-domain.com \
  -d euralis.your-domain.com \
  -d gaveurs.your-domain.com \
  -d sqal.your-domain.com \
  -d monitoring.your-domain.com

# 3. Restart nginx with SSL
docker compose -f docker-compose.prod.yml restart nginx-proxy
```

### Option 2: Custom SSL Certificates

```bash
# Place your certificates
mkdir -p docker/nginx/ssl
cp your-cert.pem docker/nginx/ssl/cert.pem
cp your-key.pem docker/nginx/ssl/key.pem
chmod 600 docker/nginx/ssl/key.pem
```

---

## Deployment

### 1. Build Images

```bash
# Set build variables
export BUILD_DATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
export VERSION=3.0.0

# Build all images
docker compose -f docker-compose.prod.yml build --no-cache

# Or build individually
docker compose -f docker-compose.prod.yml build backend
docker compose -f docker-compose.prod.yml build frontend-euralis
docker compose -f docker-compose.prod.yml build frontend-gaveurs
docker compose -f docker-compose.prod.yml build frontend-sqal
```

### 2. Initialize Database

```bash
# Start database only
docker compose -f docker-compose.prod.yml up -d timescaledb

# Wait for database to be ready
docker compose -f docker-compose.prod.yml exec timescaledb pg_isready -U gaveurs_admin

# Run migrations (if needed)
docker compose -f docker-compose.prod.yml run --rm backend python -m alembic upgrade head
```

### 3. Start All Services

```bash
# Start all services
docker compose -f docker-compose.prod.yml up -d

# Check status
docker compose -f docker-compose.prod.yml ps

# Follow logs
docker compose -f docker-compose.prod.yml logs -f
```

### 4. Verify Deployment

```bash
# Health checks
curl https://api.your-domain.com/health
curl https://euralis.your-domain.com/health
curl https://gaveurs.your-domain.com/health
curl https://sqal.your-domain.com/health

# Check all containers
docker compose -f docker-compose.prod.yml ps
```

---

## Monitoring

### 1. Start Monitoring Stack

```bash
# Start monitoring services
docker compose -f docker-compose.prod.yml -f docker-compose.monitoring.yml up -d

# Access Grafana
# URL: https://monitoring.your-domain.com
# Default: admin / <GRAFANA_ADMIN_PASSWORD>
```

### 2. Configure Dashboards

1. Login to Grafana
2. Navigate to Dashboards
3. Import pre-configured dashboards from `docker/monitoring/grafana/dashboards/`
4. Configure alerting channels

### 3. Monitoring Endpoints

- **Grafana**: https://monitoring.your-domain.com
- **Prometheus**: http://localhost:9090 (internal)
- **AlertManager**: http://localhost:9093 (internal)

---

## Backup & Recovery

### Automated Backups

Backups run automatically via cron. Configure in `.env.production`:

```bash
BACKUP_ENABLED=true
BACKUP_SCHEDULE=0 2 * * *  # 2 AM daily
BACKUP_RETENTION_DAYS=30
```

### Manual Backup

```bash
# Database backup
docker compose -f docker-compose.prod.yml exec timescaledb pg_dump \
  -U gaveurs_admin -d gaveurs_db | gzip > backup-$(date +%Y%m%d).sql.gz

# Full system backup (including volumes)
docker run --rm \
  -v gaveurs_timescaledb_data_prod:/data \
  -v /opt/gaveurs/data/backups:/backup \
  alpine tar czf /backup/timescaledb-$(date +%Y%m%d).tar.gz /data
```

### Recovery

```bash
# Restore database
gunzip -c backup-20240101.sql.gz | \
  docker compose -f docker-compose.prod.yml exec -T timescaledb \
  psql -U gaveurs_admin -d gaveurs_db

# Restore volume
docker run --rm \
  -v gaveurs_timescaledb_data_prod:/data \
  -v /opt/gaveurs/data/backups:/backup \
  alpine tar xzf /backup/timescaledb-20240101.tar.gz -C /
```

---

## Maintenance

### Update Application

```bash
# Pull latest code
git pull

# Rebuild images
docker compose -f docker-compose.prod.yml build

# Rolling update (minimal downtime)
docker compose -f docker-compose.prod.yml up -d --no-deps --build backend
docker compose -f docker-compose.prod.yml up -d --no-deps --build frontend-euralis
docker compose -f docker-compose.prod.yml up -d --no-deps --build frontend-gaveurs
docker compose -f docker-compose.prod.yml up -d --no-deps --build frontend-sqal
```

### Scale Services

```bash
# Scale backend workers
docker compose -f docker-compose.prod.yml up -d --scale backend=3

# Scale SQAL simulators
docker compose -f docker-compose.prod.yml up -d --scale simulator-sqal=5
```

### Clean Up

```bash
# Remove unused images
docker image prune -a

# Remove unused volumes (CAREFUL!)
docker volume prune

# Clean logs older than 30 days
find /opt/gaveurs/data/logs -name "*.log" -mtime +30 -delete
```

### Certificate Renewal

Certificates auto-renew via certbot container. To force renewal:

```bash
docker compose -f docker-compose.prod.yml run --rm certbot renew --force-renewal
docker compose -f docker-compose.prod.yml restart nginx-proxy
```

---

## Troubleshooting

### Container Won't Start

```bash
# Check logs
docker compose -f docker-compose.prod.yml logs <service-name>

# Check resource usage
docker stats

# Restart service
docker compose -f docker-compose.prod.yml restart <service-name>
```

### Database Connection Issues

```bash
# Check database is running
docker compose -f docker-compose.prod.yml exec timescaledb pg_isready

# Check connections
docker compose -f docker-compose.prod.yml exec timescaledb psql -U gaveurs_admin -d gaveurs_db -c "SELECT count(*) FROM pg_stat_activity;"

# Kill idle connections
docker compose -f docker-compose.prod.yml exec timescaledb psql -U gaveurs_admin -d gaveurs_db -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = 'idle' AND state_change < NOW() - INTERVAL '10 minutes';"
```

### High Memory Usage

```bash
# Check container memory
docker stats --no-stream

# Restart memory-intensive services
docker compose -f docker-compose.prod.yml restart backend redis
```

### SSL Issues

```bash
# Verify certificates
docker compose -f docker-compose.prod.yml exec nginx-proxy openssl x509 -in /etc/letsencrypt/live/your-domain.com/cert.pem -text -noout

# Test SSL configuration
docker compose -f docker-compose.prod.yml exec nginx-proxy nginx -t

# Reload nginx
docker compose -f docker-compose.prod.yml exec nginx-proxy nginx -s reload
```

### Check System Health

```bash
# Run health check script
python scripts/health_check.py --production

# Check all endpoints
curl -f https://api.your-domain.com/health || echo "API down"
curl -f https://euralis.your-domain.com/health || echo "Euralis down"
curl -f https://gaveurs.your-domain.com/health || echo "Gaveurs down"
curl -f https://sqal.your-domain.com/health || echo "SQAL down"
```

---

## Security Checklist

- [ ] Changed all default passwords
- [ ] Generated strong secret keys
- [ ] Configured firewall (UFW/iptables)
- [ ] SSL certificates installed and auto-renewing
- [ ] CORS origins restricted to production domains
- [ ] Database exposed only to internal network
- [ ] Redis password protected
- [ ] Rate limiting configured
- [ ] Monitoring and alerting active
- [ ] Backups tested and verified
- [ ] Log rotation configured
- [ ] Non-root users for all containers
- [ ] Read-only filesystems where possible
- [ ] Security headers configured in nginx
- [ ] Fail2ban installed (optional)

---

## Performance Tuning

### Database

Edit `docker/timescaledb/postgresql.conf`:
- `shared_buffers`: 25% of RAM
- `effective_cache_size`: 50-75% of RAM
- `work_mem`: RAM / max_connections / 4

### Redis

Edit `docker/redis/redis.conf`:
- `maxmemory`: Adjust based on available RAM
- `maxmemory-policy`: allkeys-lru (default)

### Backend

Edit `.env.production`:
- `GUNICORN_WORKERS`: 2-4 x CPU cores
- `DATABASE_POOL_SIZE`: 20 (adjust based on load)

---

## Support

For issues and questions:
- **Documentation**: `/documentation`
- **Health Check**: `python scripts/health_check.py`
- **Logs**: `docker compose -f docker-compose.prod.yml logs -f`
- **Monitoring**: https://monitoring.your-domain.com

---

**Last Updated**: 2024-01-01
**Version**: 3.0.0
