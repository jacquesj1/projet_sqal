# Production Quick Reference - Système Gaveurs V3.0

Quick command reference for common production operations.

## Quick Start

```bash
# Deploy everything
docker compose -f docker-compose.prod.yml --env-file .env.production up -d

# Deploy with monitoring
docker compose -f docker-compose.prod.yml -f docker-compose.monitoring.yml --env-file .env.production up -d

# Check status
docker compose -f docker-compose.prod.yml ps

# View logs
docker compose -f docker-compose.prod.yml logs -f
```

## Service Management

### Start/Stop Services

```bash
# Start all
docker compose -f docker-compose.prod.yml up -d

# Start specific service
docker compose -f docker-compose.prod.yml up -d backend

# Stop all
docker compose -f docker-compose.prod.yml down

# Stop without removing volumes
docker compose -f docker-compose.prod.yml stop

# Restart service
docker compose -f docker-compose.prod.yml restart backend
```

### View Logs

```bash
# All services
docker compose -f docker-compose.prod.yml logs -f

# Specific service
docker compose -f docker-compose.prod.yml logs -f backend

# Last 100 lines
docker compose -f docker-compose.prod.yml logs --tail=100 backend

# Since timestamp
docker compose -f docker-compose.prod.yml logs --since 2024-01-01T10:00:00 backend
```

### Check Status

```bash
# List running containers
docker compose -f docker-compose.prod.yml ps

# Check resource usage
docker stats

# Check health
docker compose -f docker-compose.prod.yml ps --format json | jq '.[].Health'
```

## Database Operations

### Connect to Database

```bash
# Interactive shell
docker compose -f docker-compose.prod.yml exec timescaledb psql -U gaveurs_admin -d gaveurs_db

# Run query
docker compose -f docker-compose.prod.yml exec timescaledb psql -U gaveurs_admin -d gaveurs_db -c "SELECT version();"
```

### Backup Database

```bash
# Create backup
docker compose -f docker-compose.prod.yml exec timescaledb pg_dump -U gaveurs_admin -d gaveurs_db | gzip > backup-$(date +%Y%m%d-%H%M%S).sql.gz

# Backup to volume
docker compose -f docker-compose.prod.yml exec timescaledb pg_dump -U gaveurs_admin -d gaveurs_db > /backups/backup-$(date +%Y%m%d-%H%M%S).sql
```

### Restore Database

```bash
# Restore from file
gunzip -c backup.sql.gz | docker compose -f docker-compose.prod.yml exec -T timescaledb psql -U gaveurs_admin -d gaveurs_db

# Restore from volume
docker compose -f docker-compose.prod.yml exec timescaledb psql -U gaveurs_admin -d gaveurs_db < /backups/backup.sql
```

### Database Maintenance

```bash
# Vacuum
docker compose -f docker-compose.prod.yml exec timescaledb psql -U gaveurs_admin -d gaveurs_db -c "VACUUM ANALYZE;"

# Check database size
docker compose -f docker-compose.prod.yml exec timescaledb psql -U gaveurs_admin -d gaveurs_db -c "SELECT pg_size_pretty(pg_database_size('gaveurs_db'));"

# List active connections
docker compose -f docker-compose.prod.yml exec timescaledb psql -U gaveurs_admin -d gaveurs_db -c "SELECT pid, usename, application_name, client_addr, state FROM pg_stat_activity;"

# Kill idle connections
docker compose -f docker-compose.prod.yml exec timescaledb psql -U gaveurs_admin -d gaveurs_db -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = 'idle' AND state_change < NOW() - INTERVAL '10 minutes';"
```

## Redis Operations

### Connect to Redis

```bash
# Redis CLI
docker compose -f docker-compose.prod.yml exec redis redis-cli -a ${REDIS_PASSWORD}

# Get info
docker compose -f docker-compose.prod.yml exec redis redis-cli -a ${REDIS_PASSWORD} INFO
```

### Redis Commands

```bash
# Check memory usage
docker compose -f docker-compose.prod.yml exec redis redis-cli -a ${REDIS_PASSWORD} INFO memory

# List all keys
docker compose -f docker-compose.prod.yml exec redis redis-cli -a ${REDIS_PASSWORD} KEYS '*'

# Flush all data (CAREFUL!)
docker compose -f docker-compose.prod.yml exec redis redis-cli -a ${REDIS_PASSWORD} FLUSHALL

# Get specific key
docker compose -f docker-compose.prod.yml exec redis redis-cli -a ${REDIS_PASSWORD} GET key_name
```

## Application Updates

### Rolling Update

```bash
# Update backend (zero downtime)
docker compose -f docker-compose.prod.yml build backend
docker compose -f docker-compose.prod.yml up -d --no-deps --build backend

# Update all frontends
docker compose -f docker-compose.prod.yml build frontend-euralis frontend-gaveurs frontend-sqal
docker compose -f docker-compose.prod.yml up -d --no-deps --build frontend-euralis frontend-gaveurs frontend-sqal
```

### Full Rebuild

```bash
# Rebuild all images
docker compose -f docker-compose.prod.yml build --no-cache

# Restart with new images
docker compose -f docker-compose.prod.yml up -d --force-recreate
```

## SSL Certificates

### Obtain Certificates

```bash
# First time
docker compose -f docker-compose.prod.yml run --rm certbot certonly \
  --webroot --webroot-path /var/www/certbot \
  --email admin@your-domain.com \
  --agree-tos --no-eff-email \
  -d your-domain.com -d api.your-domain.com
```

### Renew Certificates

```bash
# Automatic renewal
docker compose -f docker-compose.prod.yml up -d certbot

# Manual renewal
docker compose -f docker-compose.prod.yml run --rm certbot renew

# Force renewal
docker compose -f docker-compose.prod.yml run --rm certbot renew --force-renewal

# Reload nginx after renewal
docker compose -f docker-compose.prod.yml restart nginx-proxy
```

## Monitoring

### Access Monitoring

```bash
# Grafana: https://monitoring.your-domain.com
# Prometheus: http://localhost:9090
# AlertManager: http://localhost:9093
```

### Check Metrics

```bash
# Backend metrics
curl http://localhost:9100/metrics

# Prometheus targets
curl http://localhost:9090/api/v1/targets

# Grafana health
curl http://localhost:3030/api/health
```

## Troubleshooting

### Health Checks

```bash
# API health
curl https://api.your-domain.com/health

# All services
for service in api euralis gaveurs sqal; do
  echo "Checking $service..."
  curl -f https://$service.your-domain.com/health || echo "FAILED"
done
```

### Container Debugging

```bash
# Execute shell in container
docker compose -f docker-compose.prod.yml exec backend bash

# Check container logs
docker compose -f docker-compose.prod.yml logs --tail=50 backend

# Inspect container
docker inspect gaveurs_backend_prod

# Check container resources
docker stats gaveurs_backend_prod
```

### Network Debugging

```bash
# Test connectivity from backend to database
docker compose -f docker-compose.prod.yml exec backend nc -zv timescaledb 5432

# Test connectivity from backend to redis
docker compose -f docker-compose.prod.yml exec backend nc -zv redis 6379

# List networks
docker network ls | grep gaveurs

# Inspect network
docker network inspect gaveurs_backend_prod
```

### Disk Space

```bash
# Check disk usage
df -h

# Check Docker disk usage
docker system df

# Clean up
docker system prune -a --volumes  # CAREFUL!
```

## Scaling

### Scale Services

```bash
# Scale backend
docker compose -f docker-compose.prod.yml up -d --scale backend=3

# Scale SQAL simulators
docker compose -f docker-compose.prod.yml up -d --scale simulator-sqal=5
```

## Backups

### Create Backups

```bash
# Database
./scripts/backup.sh database

# Volumes
./scripts/backup.sh volumes

# Full system
./scripts/backup.sh full
```

### Restore Backups

```bash
# Database
./scripts/restore.sh database backup-20240101.sql.gz

# Volumes
./scripts/restore.sh volumes backup-20240101.tar.gz
```

## Performance

### Check Performance

```bash
# API response time
curl -w "@curl-format.txt" -o /dev/null -s https://api.your-domain.com/health

# Database queries
docker compose -f docker-compose.prod.yml exec timescaledb psql -U gaveurs_admin -d gaveurs_db -c "SELECT query, calls, total_time, mean_time FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10;"

# Container stats
docker stats --no-stream
```

### Optimize Performance

```bash
# Analyze database
docker compose -f docker-compose.prod.yml exec timescaledb psql -U gaveurs_admin -d gaveurs_db -c "ANALYZE;"

# Clear Redis cache
docker compose -f docker-compose.prod.yml exec redis redis-cli -a ${REDIS_PASSWORD} FLUSHDB

# Restart services
docker compose -f docker-compose.prod.yml restart backend redis
```

## Security

### Update Passwords

```bash
# Database password
docker compose -f docker-compose.prod.yml exec timescaledb psql -U gaveurs_admin -d gaveurs_db -c "ALTER USER gaveurs_admin WITH PASSWORD 'new_password';"

# Update .env.production
nano .env.production  # Change DATABASE_PASSWORD

# Restart services
docker compose -f docker-compose.prod.yml restart backend
```

### Check Security

```bash
# Check open ports
netstat -tulpn | grep LISTEN

# Check firewall
ufw status

# Check SSL certificate
openssl s_client -connect api.your-domain.com:443 -servername api.your-domain.com

# Scan for vulnerabilities (using trivy)
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock aquasec/trivy image gaveurs/backend:3.0.0
```

## Emergency Procedures

### Complete Shutdown

```bash
# Stop all services gracefully
docker compose -f docker-compose.prod.yml -f docker-compose.monitoring.yml down

# Force stop
docker compose -f docker-compose.prod.yml -f docker-compose.monitoring.yml kill
```

### Emergency Restart

```bash
# Restart all services
docker compose -f docker-compose.prod.yml -f docker-compose.monitoring.yml restart

# Restart specific service
docker compose -f docker-compose.prod.yml restart backend timescaledb
```

### Disaster Recovery

```bash
# 1. Stop all services
docker compose -f docker-compose.prod.yml down

# 2. Restore database
gunzip -c /path/to/backup.sql.gz | docker compose -f docker-compose.prod.yml run --rm timescaledb psql -U gaveurs_admin -d gaveurs_db

# 3. Restore volumes
docker run --rm -v gaveurs_timescaledb_data_prod:/data -v /backups:/backup alpine tar xzf /backup/data.tar.gz -C /

# 4. Start services
docker compose -f docker-compose.prod.yml up -d

# 5. Verify
python scripts/health_check.py
```

## Useful One-Liners

```bash
# Tail all logs
docker compose -f docker-compose.prod.yml logs -f --tail=10

# Restart all services
docker compose -f docker-compose.prod.yml restart

# Check which services are unhealthy
docker compose -f docker-compose.prod.yml ps --format json | jq '.[] | select(.Health == "unhealthy") | .Name'

# Get backend IP
docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' gaveurs_backend_prod

# Count running containers
docker ps | grep gaveurs | wc -l

# Show last 5 error log entries
docker compose -f docker-compose.prod.yml logs backend 2>&1 | grep -i error | tail -5

# Check certificate expiry
echo | openssl s_client -servername api.your-domain.com -connect api.your-domain.com:443 2>/dev/null | openssl x509 -noout -dates
```

---

**Last Updated**: 2024-01-01
**Version**: 3.0.0
