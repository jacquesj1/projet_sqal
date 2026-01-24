# Production Docker Deployment - Système Gaveurs V3.0

Complete production-ready Docker Compose configuration with security hardening, monitoring, and high availability.

## Overview

This production deployment includes:
- **8 core services** (database, cache, backend, 3 frontends, reverse proxy, SSL)
- **9 monitoring services** (Prometheus, Grafana, Loki, AlertManager, exporters)
- **Multi-stage Docker builds** for all services (optimized image sizes)
- **Network segmentation** (frontend, backend, database isolation)
- **Security hardening** (non-root users, read-only filesystems, rate limiting)
- **SSL/TLS** with Let's Encrypt auto-renewal
- **Comprehensive monitoring** (metrics, logs, alerts)
- **Automated backups** with 30-day retention

## Quick Start

### Prerequisites

```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install -y docker.io docker-compose-plugin

# Verify
docker --version
docker compose version
```

### Deployment

```bash
# 1. Configure environment
cp .env.production.template .env.production
nano .env.production  # Update with your values

# 2. Build images
docker compose -f docker-compose.prod.yml build

# 3. Obtain SSL certificates (first time only)
docker compose -f docker-compose.prod.yml up -d nginx-proxy
docker compose -f docker-compose.prod.yml run --rm certbot certonly \
  --webroot --webroot-path /var/www/certbot \
  --email admin@your-domain.com --agree-tos --no-eff-email \
  -d your-domain.com -d api.your-domain.com

# 4. Start all services
docker compose -f docker-compose.prod.yml up -d

# 5. Start monitoring (optional)
docker compose -f docker-compose.prod.yml -f docker-compose.monitoring.yml up -d

# 6. Verify deployment
curl https://api.your-domain.com/health
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                Internet (Ports 80/443)                       │
└────────────────────────┬────────────────────────────────────┘
                         │
                    ┌────▼─────┐
                    │  Nginx   │ SSL/TLS Termination
                    │  Proxy   │ Rate Limiting
                    │          │ Load Balancing
                    └────┬─────┘
                         │
         ┌───────────────┼────────────────┬──────────────┐
         │               │                │              │
    ┌────▼────┐     ┌────▼────┐     ┌────▼────┐    ┌────▼────┐
    │ Euralis │     │ Gaveurs │     │  SQAL   │    │ Backend │
    │  (3000) │     │  (3001) │     │ (5173)  │    │  (8000) │
    │ Next.js │     │ Next.js │     │React+Vite│   │FastAPI  │
    └─────────┘     └─────────┘     └─────────┘    └────┬────┘
                                                          │
                         ┌────────────────────────────────┼────────┐
                         │                                │        │
                    ┌────▼────┐                      ┌────▼───┐   │
                    │  Redis  │                      │  SQAL  │   │
                    │  Cache  │                      │Simulator│  │
                    │ (6379)  │                      └────────┘   │
                    └─────────┘                                   │
                                                             ┌────▼─────┐
                                                             │Timescale │
                                                             │    DB    │
                                                             │  (5432)  │
                                                             └──────────┘

┌──────────────────────────────────────────────────────────────┐
│                   Monitoring Stack                            │
│  ┌────────────┐  ┌─────────┐  ┌──────┐  ┌────────────┐     │
│  │ Prometheus │─→│ Grafana │  │ Loki │←─│  Promtail  │     │
│  │   (9090)   │  │ (3030)  │  │(3100)│  │            │     │
│  └──────┬─────┘  └─────────┘  └──────┘  └────────────┘     │
│         │                                                    │
│  ┌──────▼─────┬──────────────┬──────────────┬─────────┐    │
│  │  cAdvisor  │Node Exporter │PG Exporter   │AlertMgr │    │
│  │   (8080)   │   (9100)     │   (9187)     │ (9093)  │    │
│  └────────────┴──────────────┴──────────────┴─────────┘    │
└──────────────────────────────────────────────────────────────┘
```

## Services

### Core Services (8)

| Service          | Port(s)    | Description                           | Resources      |
|------------------|------------|---------------------------------------|----------------|
| timescaledb      | 5432       | PostgreSQL + TimescaleDB              | 4 CPU, 8GB RAM |
| redis            | 6379       | Cache & session storage               | 1 CPU, 512MB   |
| backend          | 8000, 9100 | FastAPI + Gunicorn (4 workers)        | 4 CPU, 4GB RAM |
| frontend-euralis | 3000       | Next.js (Nginx)                       | 1 CPU, 512MB   |
| frontend-gaveurs | 3001       | Next.js (Nginx)                       | 1 CPU, 512MB   |
| frontend-sqal    | 5173       | React+Vite (Nginx)                    | 1 CPU, 512MB   |
| nginx-proxy      | 80, 443    | Reverse proxy + SSL                   | 2 CPU, 1GB     |
| certbot          | -          | SSL certificate management            | 0.5 CPU, 256MB |
| simulator-sqal   | -          | IoT sensor data simulator             | 0.5 CPU, 256MB |

### Monitoring Services (9)

| Service          | Port  | Description                            | Resources      |
|------------------|-------|----------------------------------------|----------------|
| prometheus       | 9090  | Metrics collection & storage           | 2 CPU, 2GB     |
| grafana          | 3030  | Dashboards & visualization             | 2 CPU, 1GB     |
| loki             | 3100  | Log aggregation                        | 2 CPU, 2GB     |
| promtail         | 9080  | Log collection                         | 0.5 CPU, 256MB |
| cadvisor         | 8080  | Container metrics                      | 1 CPU, 512MB   |
| node-exporter    | 9101  | System metrics                         | 0.5 CPU, 256MB |
| postgres-exporter| 9187  | Database metrics                       | 0.5 CPU, 256MB |
| redis-exporter   | 9121  | Cache metrics                          | 0.5 CPU, 128MB |
| alertmanager     | 9093  | Alert routing & notifications          | 0.5 CPU, 256MB |

## Files Created

### Main Files

```
.
├── docker-compose.prod.yml               # Production compose (8 services)
├── docker-compose.monitoring.yml         # Monitoring stack (9 services)
├── .env.production.template              # Environment configuration (100+ vars)
├── PRODUCTION_DEPLOYMENT.md              # Complete deployment guide
├── PRODUCTION_QUICK_REFERENCE.md         # Command reference
├── DOCKER_PRODUCTION_SUMMARY.md          # Architecture summary
├── PRODUCTION_FILES_CREATED.md           # File listing
└── README_PRODUCTION.md                  # This file
```

### Dockerfiles (Multi-Stage)

```
backend-api/Dockerfile.prod               # Backend (2 stages)
euralis-frontend/Dockerfile.prod          # Euralis (3 stages)
gaveurs-frontend/Dockerfile.prod          # Gaveurs (3 stages)
sqal/Dockerfile.prod                      # SQAL (3 stages)
simulator-sqal/Dockerfile.prod            # Simulator (2 stages)
```

### Configurations

```
docker/
├── nginx/                                # Reverse proxy configs (6 files)
│   ├── nginx.conf
│   └── conf.d/*.conf
├── monitoring/                           # Monitoring configs (8 files)
│   ├── prometheus/
│   ├── grafana/
│   ├── loki/
│   ├── promtail/
│   └── alertmanager/
├── timescaledb/                          # Database configs (2 files)
│   ├── postgresql.conf
│   └── pg_hba.conf
└── redis/                                # Cache config (1 file)
    └── redis.conf
```

**Total**: 32 files, 5750+ lines of configuration

## Security Features

- [x] **Network Segmentation**: 3 isolated networks (frontend, backend, database)
- [x] **Non-Root Users**: All containers run as non-root
- [x] **Read-Only Filesystems**: Applied where possible
- [x] **SSL/TLS**: Let's Encrypt with auto-renewal
- [x] **Security Headers**: X-Frame-Options, CSP, HSTS, etc.
- [x] **Rate Limiting**: 3 zones (general, API, auth)
- [x] **CORS**: Configurable origins
- [x] **Secrets Management**: Environment-based, no hardcoded values
- [x] **Database Auth**: SCRAM-SHA-256 encryption
- [x] **Redis Auth**: Password protected
- [x] **Resource Limits**: CPU and memory constraints
- [x] **Security Options**: no-new-privileges, seccomp

## Monitoring Features

- [x] **Metrics**: Prometheus scraping 9 targets every 15s
- [x] **Logs**: Loki aggregating all container and application logs
- [x] **Dashboards**: Grafana with pre-configured system overview
- [x] **Alerts**: 25+ alert rules across 6 categories
- [x] **Notifications**: Email and Slack integration
- [x] **Container Metrics**: cAdvisor monitoring all containers
- [x] **System Metrics**: Node Exporter for host metrics
- [x] **Database Metrics**: Postgres Exporter for TimescaleDB
- [x] **Cache Metrics**: Redis Exporter
- [x] **Health Checks**: All services with automated restart

## Configuration

### Critical Environment Variables

```bash
# .env.production (must configure)

# Database
DATABASE_PASSWORD=<strong-password>

# Redis
REDIS_PASSWORD=<strong-password>

# Security
SECRET_KEY=<openssl rand -hex 32>
JWT_SECRET_KEY=<openssl rand -hex 32>

# Domains
DOMAIN=your-domain.com
API_DOMAIN=api.your-domain.com
EURALIS_DOMAIN=euralis.your-domain.com
GAVEURS_DOMAIN=gaveurs.your-domain.com
SQAL_DOMAIN=sqal.your-domain.com

# SSL
LETSENCRYPT_EMAIL=admin@your-domain.com

# Monitoring
GRAFANA_ADMIN_PASSWORD=<strong-password>
ALERTMANAGER_SLACK_WEBHOOK=<webhook-url>
```

### Generate Secrets

```bash
# Strong passwords (32 characters)
openssl rand -base64 32

# Hex keys (64 characters)
openssl rand -hex 32
```

## Common Operations

### View Logs

```bash
# All services
docker compose -f docker-compose.prod.yml logs -f

# Specific service
docker compose -f docker-compose.prod.yml logs -f backend

# Last 100 lines
docker compose -f docker-compose.prod.yml logs --tail=100 backend
```

### Database Operations

```bash
# Connect
docker compose -f docker-compose.prod.yml exec timescaledb psql -U gaveurs_admin -d gaveurs_db

# Backup
docker compose -f docker-compose.prod.yml exec timescaledb pg_dump -U gaveurs_admin gaveurs_db | gzip > backup.sql.gz

# Restore
gunzip -c backup.sql.gz | docker compose -f docker-compose.prod.yml exec -T timescaledb psql -U gaveurs_admin -d gaveurs_db
```

### Update Application

```bash
# Rolling update (zero downtime)
docker compose -f docker-compose.prod.yml build backend
docker compose -f docker-compose.prod.yml up -d --no-deps backend

# Update all frontends
docker compose -f docker-compose.prod.yml build frontend-euralis frontend-gaveurs frontend-sqal
docker compose -f docker-compose.prod.yml up -d --no-deps frontend-euralis frontend-gaveurs frontend-sqal
```

### Scale Services

```bash
# Scale backend to 3 instances
docker compose -f docker-compose.prod.yml up -d --scale backend=3

# Scale SQAL simulators
docker compose -f docker-compose.prod.yml up -d --scale simulator-sqal=5
```

### SSL Certificate Renewal

```bash
# Automatic (runs daily via certbot container)
docker compose -f docker-compose.prod.yml up -d certbot

# Manual renewal
docker compose -f docker-compose.prod.yml run --rm certbot renew

# Force renewal
docker compose -f docker-compose.prod.yml run --rm certbot renew --force-renewal

# Reload nginx
docker compose -f docker-compose.prod.yml restart nginx-proxy
```

## Monitoring Access

### Grafana

- **URL**: https://monitoring.your-domain.com (or http://localhost:3030)
- **Default Login**: admin / <GRAFANA_ADMIN_PASSWORD>
- **Dashboards**: System Overview, Database, Redis, Logs

### Prometheus

- **URL**: http://localhost:9090 (internal only)
- **Targets**: http://localhost:9090/targets
- **Alerts**: http://localhost:9090/alerts

### AlertManager

- **URL**: http://localhost:9093 (internal only)
- **Notifications**: Configured via email and Slack

## Health Checks

```bash
# API
curl https://api.your-domain.com/health

# Frontends
curl https://euralis.your-domain.com/health
curl https://gaveurs.your-domain.com/health
curl https://sqal.your-domain.com/health

# Container health
docker compose -f docker-compose.prod.yml ps

# All endpoints
for service in api euralis gaveurs sqal; do
  echo "Checking $service..."
  curl -f https://$service.your-domain.com/health || echo "FAILED"
done
```

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

### High Memory Usage

```bash
# Check container memory
docker stats --no-stream

# Restart memory-intensive services
docker compose -f docker-compose.prod.yml restart backend redis timescaledb
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

## Backup & Recovery

### Automated Backups

```bash
# Configure in .env.production
BACKUP_ENABLED=true
BACKUP_SCHEDULE=0 2 * * *  # 2 AM daily
BACKUP_RETENTION_DAYS=30
```

### Manual Backup

```bash
# Database
docker compose -f docker-compose.prod.yml exec timescaledb pg_dump -U gaveurs_admin gaveurs_db | gzip > backup-$(date +%Y%m%d).sql.gz

# Volumes
docker run --rm -v gaveurs_timescaledb_data_prod:/data -v /backups:/backup alpine tar czf /backup/data-$(date +%Y%m%d).tar.gz /data
```

### Restore

```bash
# Database
gunzip -c backup-20240101.sql.gz | docker compose -f docker-compose.prod.yml exec -T timescaledb psql -U gaveurs_admin -d gaveurs_db

# Volumes
docker run --rm -v gaveurs_timescaledb_data_prod:/data -v /backups:/backup alpine tar xzf /backup/data-20240101.tar.gz -C /
```

## Performance Tuning

### Database (postgresql.conf)

```ini
# Adjust based on available RAM
shared_buffers = 2GB              # 25% of RAM
effective_cache_size = 6GB        # 50-75% of RAM
work_mem = 16MB                   # RAM / max_connections / 4
```

### Backend (.env.production)

```bash
# Gunicorn workers (2-4 x CPU cores)
GUNICORN_WORKERS=4

# Database connection pool
DATABASE_POOL_SIZE=20
DATABASE_MAX_OVERFLOW=40
```

### Redis (redis.conf)

```ini
# Adjust memory limit
maxmemory 512mb
maxmemory-policy allkeys-lru
```

## Resource Requirements

### Minimum

- CPU: 4 cores
- RAM: 16GB
- Disk: 250GB SSD
- Network: 100Mbps

### Recommended

- CPU: 8 cores
- RAM: 32GB
- Disk: 500GB SSD
- Network: 1Gbps

### Production (with monitoring)

- CPU: 12+ cores
- RAM: 32GB+
- Disk: 1TB SSD
- Network: 1Gbps+

## Documentation

- **PRODUCTION_DEPLOYMENT.md** - Complete deployment guide (setup, SSL, monitoring)
- **PRODUCTION_QUICK_REFERENCE.md** - Command reference (operations, troubleshooting)
- **DOCKER_PRODUCTION_SUMMARY.md** - Architecture and features overview
- **PRODUCTION_FILES_CREATED.md** - Complete file listing

## Support

For issues:
1. Check logs: `docker compose -f docker-compose.prod.yml logs -f`
2. Check health: `docker compose -f docker-compose.prod.yml ps`
3. Review documentation in `/documentation`
4. Run health check: `python scripts/health_check.py --production`

## License

Proprietary - A Deep Adventure

---

**Version**: 3.0.0
**Last Updated**: 2024-01-01
**Maintainer**: contact@adeep.fr
