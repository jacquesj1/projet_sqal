# Guide de Déploiement Production - Système Gaveurs V3.0

## Vue d'ensemble

Guide complet pour déployer le système Gaveurs V3.0 en production avec :
- CI/CD automatisé (GitHub Actions)
- Docker Compose avec optimisations production
- Authentification Keycloak centralisée
- Backup/restore automatisés avec chiffrement
- Monitoring et logging centralisés
- SSL/TLS avec Let's Encrypt
- Intégration de données réelles Euralis
- Entraînement de modèles IA

## Table des matières

1. [Prérequis](#prérequis)
2. [Architecture Production](#architecture-production)
3. [Déploiement Initial](#déploiement-initial)
4. [CI/CD Pipeline](#cicd-pipeline)
5. [Backup et Restore](#backup-et-restore)
6. [Keycloak Setup](#keycloak-setup)
7. [Monitoring](#monitoring)
8. [Sécurité](#sécurité)
9. [Maintenance](#maintenance)
10. [Troubleshooting](#troubleshooting)

---

## Prérequis

### Serveur de Production

**Spécifications minimales recommandées** :
- CPU: 8 cores
- RAM: 32 GB
- Disque: 500 GB SSD (TimescaleDB + logs + backups)
- OS: Ubuntu 22.04 LTS / Debian 12 / RHEL 9

**Logiciels requis** :
```bash
# Docker et Docker Compose
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Git
sudo apt update
sudo apt install -y git

# Outils de backup
sudo apt install -y postgresql-client-15 gnupg2 tar gzip
```

**Ports requis** (à ouvrir dans le firewall) :
- 80 (HTTP - redirection vers HTTPS)
- 443 (HTTPS - Nginx reverse proxy)
- 8080 (Keycloak - en interne uniquement)
- 5432 (TimescaleDB - en interne uniquement)
- 6379 (Redis - en interne uniquement)

### Domaines et DNS

Configurer les enregistrements DNS suivants :
```
A     euralis.votredomaine.com     → IP_SERVEUR
A     gaveurs.votredomaine.com     → IP_SERVEUR
A     sqal.votredomaine.com        → IP_SERVEUR
A     api.votredomaine.com         → IP_SERVEUR
A     auth.votredomaine.com        → IP_SERVEUR
```

### Secrets et Variables d'Environnement

Créer un fichier `.env.production` :
```env
# Database
POSTGRES_DB=gaveurs_db
POSTGRES_USER=gaveurs_admin
POSTGRES_PASSWORD=<strong_random_password>
DATABASE_URL=postgresql://gaveurs_admin:<password>@timescaledb:5432/gaveurs_db

# Keycloak
KEYCLOAK_ADMIN=admin
KEYCLOAK_ADMIN_PASSWORD=<strong_random_password>
KEYCLOAK_DB_PASSWORD=<strong_random_password>
KEYCLOAK_SERVER_URL=https://auth.votredomaine.com
KEYCLOAK_REALM=sqal_realm
KEYCLOAK_CLIENT_SECRET=<generate_with_keycloak>

# Backend
SECRET_KEY=<generate_32_byte_secret>
JWT_SECRET=<generate_32_byte_secret>
REDIS_URL=redis://redis:6379/0

# Frontends
NEXT_PUBLIC_API_URL=https://api.votredomaine.com
VITE_API_URL=https://api.votredomaine.com
VITE_WS_URL=wss://api.votredomaine.com

# Backup
BACKUP_ENCRYPTION_KEY=<generate_gpg_key_id>
AWS_ACCESS_KEY_ID=<your_aws_key>
AWS_SECRET_ACCESS_KEY=<your_aws_secret>
AWS_S3_BUCKET=gaveurs-backups
BACKUP_RETENTION_DAYS=7
BACKUP_RETENTION_WEEKS=4
BACKUP_RETENTION_MONTHS=12

# Email (pour notifications)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=notifications@votredomaine.com
SMTP_PASSWORD=<app_password>
SMTP_FROM=notifications@votredomaine.com

# Slack (optionnel)
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL

# Let's Encrypt
LETSENCRYPT_EMAIL=admin@votredomaine.com
```

**Générer les secrets** :
```bash
# SECRET_KEY et JWT_SECRET (32 bytes)
openssl rand -hex 32

# GPG Key pour backup encryption
gpg --full-generate-key
# Suivre les instructions, noter le Key ID

# Export public key (pour restore sur autre serveur)
gpg --export -a "Backup Key" > backup-public.key
```

---

## Architecture Production

### Diagramme d'architecture

```
                    ┌─────────────────────┐
                    │   Let's Encrypt     │
                    │   (Certbot)         │
                    └──────────┬──────────┘
                               │ SSL Certs
                    ┌──────────▼──────────┐
                    │   Nginx Reverse     │
Internet ──────────▶│   Proxy + SSL       │
                    │   (Port 443)        │
                    └──┬───┬───┬───┬───┬──┘
                       │   │   │   │   │
           ┌───────────┘   │   │   │   └───────────┐
           │               │   │   │               │
    ┌──────▼──────┐ ┌─────▼───▼───▼─────┐ ┌───────▼────────┐
    │  Keycloak   │ │   Backend API      │ │  3 Frontends   │
    │  (8080)     │ │   FastAPI          │ │  (Next/Vite)   │
    └──────┬──────┘ │   Gunicorn         │ └────────────────┘
           │        │   (8000)           │
    ┌──────▼──────┐ └─────┬───┬──────────┘
    │ Keycloak DB │       │   │
    │ PostgreSQL  │ ┌─────▼───▼──────┐ ┌──────────────┐
    └─────────────┘ │  TimescaleDB   │ │    Redis     │
                    │  (5432)        │ │    (6379)    │
                    └────────┬───────┘ └──────────────┘
                             │
                    ┌────────▼─────────┐
                    │  Backup Cron Job │
                    │  (Daily 2:00 AM) │
                    └────────┬─────────┘
                             │
                    ┌────────▼─────────┐
                    │   AWS S3 /       │
                    │   Azure Blob     │
                    └──────────────────┘

                    Monitoring Stack (Optionnel)
                    ┌──────────────────┐
                    │   Prometheus     │
                    │   Grafana        │
                    │   Loki (Logs)    │
                    └──────────────────┘
```

### Réseau Docker

Le `docker-compose.prod.yml` définit 3 réseaux isolés :
- **frontend-network** : Frontends ↔ Nginx
- **backend-network** : Backend ↔ Frontends ↔ Nginx
- **db-network** : Backend ↔ TimescaleDB ↔ Redis (isolé d'Internet)

---

## Déploiement Initial

### 1. Cloner le repository

```bash
cd /opt
sudo git clone https://github.com/votre-org/projet-euralis-gaveurs.git
cd projet-euralis-gaveurs
sudo chown -R $USER:$USER .
```

### 2. Configuration

```bash
# Copier l'exemple d'environnement
cp .env.example .env.production

# Éditer avec vos valeurs
nano .env.production

# Valider la configuration
docker-compose -f docker-compose.prod.yml config
```

### 3. Build des images

```bash
# Build toutes les images (multi-stage Dockerfiles)
docker-compose -f docker-compose.prod.yml build

# Vérifier les images créées
docker images | grep gaveurs
```

**Images créées** :
- `gaveurs-backend:latest` (Python 3.11 + Julia + PySR)
- `gaveurs-euralis-frontend:latest` (Next.js + Nginx)
- `gaveurs-gaveurs-frontend:latest` (Next.js + Nginx)
- `gaveurs-sqal-frontend:latest` (Vite + Nginx)
- `gaveurs-simulator:latest` (Python + WebSocket client)

### 4. Initialiser la base de données

```bash
# Démarrer uniquement TimescaleDB
docker-compose -f docker-compose.prod.yml up -d timescaledb

# Attendre que la DB soit prête
docker-compose -f docker-compose.prod.yml logs -f timescaledb
# Attendre "database system is ready to accept connections"

# Appliquer les migrations
docker-compose -f docker-compose.prod.yml run --rm backend python scripts/db_migrate.py

# Générer des données de test (optionnel)
docker-compose -f docker-compose.prod.yml run --rm backend \
  python scripts/generate_test_data.py --gaveurs 50 --lots 100 --samples 1000 --feedbacks 500
```

### 5. Démarrer Keycloak

```bash
# Démarrer Keycloak + sa DB
docker-compose -f docker-compose.prod.yml up -d keycloak-postgres keycloak

# Logs
docker-compose -f docker-compose.prod.yml logs -f keycloak

# Accéder à l'interface admin
# https://auth.votredomaine.com (après configuration SSL)
# Ou temporairement: http://IP_SERVEUR:8080
```

**Configuration Keycloak** : Voir [KEYCLOAK_SETUP.md](./KEYCLOAK_SETUP.md) pour :
- Créer le realm `sqal_realm`
- Configurer les 4 clients (sqal-frontend, euralis-frontend, gaveurs-frontend, backend-api)
- Créer les rôles et utilisateurs de test

### 6. Configurer SSL avec Let's Encrypt

```bash
# Modifier docker-compose.prod.yml pour activer Certbot
# (déjà configuré dans le fichier)

# Obtenir les certificats SSL
docker-compose -f docker-compose.prod.yml run --rm certbot certonly \
  --webroot \
  --webroot-path=/var/www/certbot \
  --email admin@votredomaine.com \
  --agree-tos \
  --no-eff-email \
  -d euralis.votredomaine.com \
  -d gaveurs.votredomaine.com \
  -d sqal.votredomaine.com \
  -d api.votredomaine.com \
  -d auth.votredomaine.com

# Les certificats sont dans: /etc/letsencrypt/live/votredomaine.com/
```

### 7. Démarrer tous les services

```bash
# Démarrer tout
docker-compose -f docker-compose.prod.yml up -d

# Vérifier le statut
docker-compose -f docker-compose.prod.yml ps

# Logs de tous les services
docker-compose -f docker-compose.prod.yml logs -f

# Vérifier la santé
curl https://api.votredomaine.com/health
```

### 8. Vérifier les applications

Accéder aux URLs :
- **Backend API** : https://api.votredomaine.com/docs
- **Euralis Dashboard** : https://euralis.votredomaine.com/euralis/dashboard
- **Gaveurs App** : https://gaveurs.votredomaine.com
- **SQAL Quality Control** : https://sqal.votredomaine.com
- **Keycloak** : https://auth.votredomaine.com

---

## CI/CD Pipeline

### GitHub Actions Workflow

Le fichier `.github/workflows/ci-cd.yml` automatise :
1. **Tests** (sur chaque push/PR)
2. **Build** (sur push vers `main` ou `develop`)
3. **Deploy** (sur push vers `main`)

### Configuration GitHub Secrets

Ajouter les secrets suivants dans GitHub :
```
Settings → Secrets and variables → Actions → New repository secret
```

**Secrets requis** :
```
DOCKER_USERNAME           # Docker Hub username
DOCKER_PASSWORD           # Docker Hub password ou token
SSH_PRIVATE_KEY           # Clé SSH pour déploiement sur serveur
SSH_HOST                  # IP ou hostname du serveur de production
SSH_USER                  # Utilisateur SSH (ex: deploy)
DATABASE_URL              # URL de la base de production
POSTGRES_PASSWORD         # Mot de passe PostgreSQL
KEYCLOAK_CLIENT_SECRET    # Secret Keycloak backend-api
SECRET_KEY                # Secret key backend
JWT_SECRET                # JWT secret backend
SLACK_WEBHOOK             # Webhook Slack pour notifications (optionnel)
```

### Workflow Phases

#### 1. Tests (sur chaque push/PR)

```yaml
# Exécuté automatiquement
- Backend tests (163 tests avec pytest)
- Frontend SQAL tests (87 tests Jest)
- Frontend Euralis tests (106 tests Jest)
- Frontend Gaveurs tests (260 tests Jest)
- Security scanning (Trivy, Snyk)
- Coverage reports (Codecov)
```

#### 2. Build (sur push vers main/develop)

```yaml
# Build et push des images Docker
- gaveurs-backend:latest
- gaveurs-euralis-frontend:latest
- gaveurs-gaveurs-frontend:latest
- gaveurs-sqal-frontend:latest
- gaveurs-simulator:latest
```

#### 3. Deploy (sur push vers main uniquement)

```yaml
# Déploiement automatique sur serveur de production
1. SSH vers serveur
2. Pull des nouvelles images
3. docker-compose down (graceful shutdown)
4. docker-compose up -d (démarrage avec nouvelles images)
5. Health check
6. Notification Slack
7. Rollback automatique si échec
```

### Déclencher un déploiement manuel

```bash
# Option 1: Push vers main
git push origin main

# Option 2: Workflow dispatch (bouton GitHub)
Actions → CI/CD Pipeline → Run workflow

# Option 3: Tag de release
git tag -a v3.0.0 -m "Production release v3.0.0"
git push origin v3.0.0
```

### Rollback en cas de problème

```bash
# SSH vers le serveur
ssh deploy@serveur-production

cd /opt/projet-euralis-gaveurs

# Revenir à la version précédente
git log --oneline  # Trouver le commit précédent
git checkout <commit_hash>

# Rebuild et redémarrer
docker-compose -f docker-compose.prod.yml build
docker-compose -f docker-compose.prod.yml up -d

# Ou pull une image Docker tagguée
docker-compose -f docker-compose.prod.yml pull gaveurs-backend:v2.9.0
```

---

## Backup et Restore

### Scripts de Backup

Deux scripts disponibles :
- **Linux/macOS** : `scripts/backup.sh`
- **Windows** : `scripts/backup.bat`

### Configuration du Backup Automatisé

#### Linux (Cron)

```bash
# Éditer le crontab
crontab -e

# Ajouter backup quotidien à 2h du matin
0 2 * * * /opt/projet-euralis-gaveurs/scripts/backup.sh --type full --encrypt --upload s3 >> /var/log/gaveurs-backup.log 2>&1

# Backup hebdomadaire (dimanche 3h)
0 3 * * 0 /opt/projet-euralis-gaveurs/scripts/backup.sh --type full --encrypt --upload s3 --retention weekly >> /var/log/gaveurs-backup.log 2>&1

# Backup mensuel (1er du mois 4h)
0 4 1 * * /opt/projet-euralis-gaveurs/scripts/backup.sh --type full --encrypt --upload s3 --retention monthly >> /var/log/gaveurs-backup.log 2>&1
```

#### Windows (Task Scheduler)

```powershell
# Créer une tâche planifiée
schtasks /create /tn "Gaveurs Backup Daily" /tr "C:\gaveurs\scripts\backup.bat --type full --encrypt --upload azure" /sc daily /st 02:00 /ru SYSTEM
```

### Types de Backup

**1. Full Backup** (recommandé quotidien) :
```bash
./scripts/backup.sh --type full --encrypt --upload s3
```
- Base de données complète (pg_dump)
- Fichiers uploadés (uploads/)
- Configuration (.env, docker-compose.yml)
- Données blockchain (si applicable)

**2. Incremental Backup** (optionnel) :
```bash
./scripts/backup.sh --type incremental --encrypt
```
- Uniquement les changements depuis le dernier backup
- Plus rapide, moins d'espace disque

**3. Schema Only** (avant migration) :
```bash
./scripts/backup.sh --type schema --encrypt
```
- Structure de la base uniquement (pas de données)

### Options de Backup

```bash
# Toutes les options
./scripts/backup.sh \
  --type full \                    # Type: full, incremental, schema
  --encrypt \                      # Chiffrement GPG (AES256)
  --upload s3 \                    # Upload vers S3 (ou 'azure')
  --retention daily \              # Politique: daily, weekly, monthly
  --compression gzip \             # gzip (défaut) ou lz4
  --email admin@domain.com \       # Email de notification
  --slack \                        # Notification Slack
  --dry-run                        # Test sans exécuter
```

### Politiques de Rétention

Les backups sont automatiquement nettoyés selon la politique :
- **Daily** : 7 jours
- **Weekly** : 4 semaines
- **Monthly** : 12 mois

Configuration dans `.env.production` :
```env
BACKUP_RETENTION_DAYS=7
BACKUP_RETENTION_WEEKS=4
BACKUP_RETENTION_MONTHS=12
```

### Restore depuis Backup

#### 1. Restore local

```bash
# Lister les backups disponibles
ls -lh backups/

# Restore complet
./scripts/restore.sh --backup backups/gaveurs_backup_2025-01-15_full.tar.gz.gpg --decrypt

# Ou manuellement
cd backups
gpg --decrypt gaveurs_backup_2025-01-15_full.tar.gz.gpg | tar -xzf -
psql -U gaveurs_admin -d gaveurs_db < database_dump.sql
```

#### 2. Restore depuis S3

```bash
# Download depuis S3
aws s3 cp s3://gaveurs-backups/2025-01-15/gaveurs_backup_full.tar.gz.gpg ./

# Decrypt et restore
gpg --decrypt gaveurs_backup_full.tar.gz.gpg | tar -xzf -
psql -U gaveurs_admin -d gaveurs_db < database_dump.sql
```

#### 3. Restore sur nouveau serveur

```bash
# 1. Installer Docker et PostgreSQL client
apt install -y docker.io postgresql-client-15 gnupg2

# 2. Importer la clé GPG publique
gpg --import backup-public.key

# 3. Download backup depuis S3
aws configure  # Configurer credentials AWS
aws s3 cp s3://gaveurs-backups/2025-01-15/gaveurs_backup_full.tar.gz.gpg ./

# 4. Déchiffrer
gpg --decrypt gaveurs_backup_full.tar.gz.gpg > gaveurs_backup_full.tar.gz

# 5. Extraire
tar -xzf gaveurs_backup_full.tar.gz

# 6. Démarrer TimescaleDB
docker run -d --name timescaledb \
  -e POSTGRES_PASSWORD=nouveau_password \
  -p 5432:5432 \
  timescale/timescaledb:latest-pg15

# 7. Restore database
psql -h localhost -U postgres -d postgres < database_dump.sql

# 8. Restore files
cp -r uploads /opt/projet-euralis-gaveurs/
cp .env.production /opt/projet-euralis-gaveurs/
```

### Vérifier l'Intégrité des Backups

```bash
# Test restore (sans écraser la production)
./scripts/backup.sh --verify backups/gaveurs_backup_2025-01-15_full.tar.gz.gpg

# Ou manuellement
gpg --verify gaveurs_backup_full.tar.gz.gpg
tar -tzf <(gpg --decrypt gaveurs_backup_full.tar.gz.gpg) | head -20
```

---

## Keycloak Setup

Voir la documentation complète : [KEYCLOAK_SETUP.md](./KEYCLOAK_SETUP.md)

### Résumé Déploiement

1. **Démarrer Keycloak** :
```bash
docker-compose -f docker-compose.prod.yml up -d keycloak
```

2. **Accéder à l'admin console** : https://auth.votredomaine.com

3. **Créer le realm** : `sqal_realm`

4. **Créer les 4 clients** :
   - `sqal-frontend` (public, PKCE)
   - `euralis-frontend` (public, PKCE)
   - `gaveurs-frontend` (public, PKCE)
   - `backend-api` (confidential, service account)

5. **Créer les rôles** :
   - super_admin
   - org_admin
   - quality_manager
   - production_operator
   - data_analyst
   - viewer

6. **Créer les utilisateurs de test** (voir tableau dans KEYCLOAK_SETUP.md)

7. **Configurer le backend** :
```python
# app/auth/keycloak.py déjà créé
# Voir KEYCLOAK_SETUP.md pour détails
```

8. **Tester l'authentification** :
```bash
# Obtenir un token
curl -X POST "https://auth.votredomaine.com/realms/sqal_realm/protocol/openid-connect/token" \
  -d "client_id=backend-api" \
  -d "client_secret=<secret>" \
  -d "grant_type=password" \
  -d "username=admin@sqal.com" \
  -d "password=Admin123!"

# Utiliser le token
curl -H "Authorization: Bearer <token>" https://api.votredomaine.com/api/dashboard
```

---

## Monitoring

### Prometheus + Grafana (Optionnel)

Ajouter au `docker-compose.prod.yml` :

```yaml
services:
  prometheus:
    image: prom/prometheus:latest
    container_name: prometheus
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus-data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--storage.tsdb.retention.time=90d'
    ports:
      - "9090:9090"
    networks:
      - backend-network
    restart: unless-stopped

  grafana:
    image: grafana/grafana:latest
    container_name: grafana
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=<strong_password>
      - GF_INSTALL_PLUGINS=grafana-clock-panel,grafana-simple-json-datasource
    volumes:
      - grafana-data:/var/lib/grafana
      - ./monitoring/grafana-dashboards:/etc/grafana/provisioning/dashboards
    ports:
      - "3003:3000"
    depends_on:
      - prometheus
    networks:
      - backend-network
    restart: unless-stopped

  loki:
    image: grafana/loki:latest
    container_name: loki
    ports:
      - "3100:3100"
    volumes:
      - loki-data:/loki
    networks:
      - backend-network
    restart: unless-stopped

volumes:
  prometheus-data:
  grafana-data:
  loki-data:
```

### Configuration Prometheus

Créer `monitoring/prometheus.yml` :

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'backend-api'
    static_configs:
      - targets: ['backend:8000']
    metrics_path: '/metrics'

  - job_name: 'timescaledb'
    static_configs:
      - targets: ['timescaledb:5432']

  - job_name: 'redis'
    static_configs:
      - targets: ['redis:6379']

  - job_name: 'docker'
    static_configs:
      - targets: ['host.docker.internal:9323']
```

### Dashboards Grafana

Dashboards recommandés (importer depuis Grafana.com) :
- **Docker & System** : ID 893 (Docker monitoring)
- **TimescaleDB** : ID 455 (PostgreSQL + TimescaleDB)
- **FastAPI** : Créer dashboard custom avec métriques :
  - Request latency (p50, p95, p99)
  - Request rate
  - Error rate
  - Active connections
  - DB connection pool status

### Alerting

Configurer les alertes Prometheus (`monitoring/alerts.yml`) :

```yaml
groups:
  - name: system
    rules:
      - alert: HighMemoryUsage
        expr: (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes) < 0.1
        for: 5m
        annotations:
          summary: "High memory usage on {{ $labels.instance }}"

      - alert: HighCPUUsage
        expr: 100 - (avg by (instance) (irate(node_cpu_seconds_total{mode="idle"}[5m])) * 100) > 80
        for: 5m
        annotations:
          summary: "High CPU usage on {{ $labels.instance }}"

  - name: database
    rules:
      - alert: DatabaseDown
        expr: up{job="timescaledb"} == 0
        for: 1m
        annotations:
          summary: "TimescaleDB is down"

      - alert: HighDatabaseConnections
        expr: pg_stat_database_numbackends > 80
        for: 5m
        annotations:
          summary: "High number of database connections"

  - name: application
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
        for: 5m
        annotations:
          summary: "High error rate on API"

      - alert: SlowRequests
        expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 2
        for: 5m
        annotations:
          summary: "95th percentile request latency > 2s"
```

---

## Sécurité

### 1. Firewall (UFW)

```bash
# Installer UFW
sudo apt install ufw

# Règles par défaut
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Autoriser SSH
sudo ufw allow 22/tcp

# Autoriser HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Activer le firewall
sudo ufw enable

# Vérifier le statut
sudo ufw status verbose
```

### 2. Fail2Ban (Protection SSH)

```bash
# Installer
sudo apt install fail2ban

# Configuration
sudo nano /etc/fail2ban/jail.local
```

```ini
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5

[sshd]
enabled = true
port = 22
logpath = /var/log/auth.log
```

```bash
# Démarrer
sudo systemctl enable fail2ban
sudo systemctl start fail2ban

# Vérifier
sudo fail2ban-client status sshd
```

### 3. SSL/TLS Configuration

Le Nginx reverse proxy est configuré avec :
- TLS 1.2 et 1.3 uniquement
- Ciphers modernes (pas de RC4, 3DES, etc.)
- HSTS (HTTP Strict Transport Security)
- OCSP Stapling
- Renouvellement automatique Let's Encrypt

Voir `nginx/nginx.conf` pour la configuration complète.

### 4. Docker Security

**Best practices appliquées** :
- Tous les containers utilisent des utilisateurs non-root
- Read-only filesystems où possible
- Resource limits (CPU, memory)
- Network segmentation (3 réseaux isolés)
- No privileged containers
- Secrets via Docker secrets (pas d'env vars en clair)

**Scan de sécurité** :
```bash
# Installer Trivy
wget -qO - https://aquasecurity.github.io/trivy-repo/deb/public.key | sudo apt-key add -
echo "deb https://aquasecurity.github.io/trivy-repo/deb $(lsb_release -sc) main" | sudo tee -a /etc/apt/sources.list.d/trivy.list
sudo apt update
sudo apt install trivy

# Scanner les images
trivy image gaveurs-backend:latest
trivy image gaveurs-euralis-frontend:latest
```

### 5. Database Security

**PostgreSQL hardening** :
```sql
-- Créer un utilisateur read-only pour les rapports
CREATE USER reporter WITH PASSWORD '<strong_password>';
GRANT CONNECT ON DATABASE gaveurs_db TO reporter;
GRANT USAGE ON SCHEMA public TO reporter;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO reporter;

-- Audit logging
ALTER SYSTEM SET log_statement = 'all';
ALTER SYSTEM SET log_connections = 'on';
ALTER SYSTEM SET log_disconnections = 'on';

-- Recharger la config
SELECT pg_reload_conf();
```

**Chiffrement** :
- SSL/TLS pour les connexions PostgreSQL
- Encryption at rest (LUKS pour les volumes)
- Backup encryption (GPG AES256)

### 6. API Security

**Rate limiting** (ajouter au backend) :

```python
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

@app.get("/api/public/data")
@limiter.limit("100/hour")
async def public_endpoint(request: Request):
    return {"data": "..."}
```

**CORS restrictif** (en production) :

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://euralis.votredomaine.com",
        "https://gaveurs.votredomaine.com",
        "https://sqal.votredomaine.com"
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)
```

### 7. Secrets Management

**Option 1: Docker Secrets** (recommandé pour Docker Swarm)

```bash
# Créer un secret
echo "my_secret_password" | docker secret create postgres_password -

# Utiliser dans docker-compose.yml
services:
  timescaledb:
    secrets:
      - postgres_password
    environment:
      POSTGRES_PASSWORD_FILE: /run/secrets/postgres_password

secrets:
  postgres_password:
    external: true
```

**Option 2: HashiCorp Vault** (pour environnement complexe)

**Option 3: .env.production avec permissions strictes**

```bash
chmod 600 .env.production
chown root:root .env.production
```

---

## Maintenance

### Mises à Jour

#### 1. Mise à jour du code

```bash
# Pull dernières modifications
git fetch origin
git checkout main
git pull origin main

# Rebuild les images
docker-compose -f docker-compose.prod.yml build

# Redémarrer avec nouvelles images
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml up -d
```

#### 2. Mise à jour des dépendances

**Backend** :
```bash
cd backend-api
source venv/bin/activate
pip install --upgrade -r requirements.txt
pip freeze > requirements.txt

# Rebuild l'image
docker-compose -f docker-compose.prod.yml build backend
```

**Frontends** :
```bash
cd euralis-frontend
npm update
npm audit fix

# Rebuild
docker-compose -f docker-compose.prod.yml build euralis-frontend
```

#### 3. Mise à jour Docker images

```bash
# Pull latest base images
docker pull python:3.11-slim
docker pull node:20-alpine
docker pull nginx:alpine
docker pull timescale/timescaledb:latest-pg15

# Rebuild avec --no-cache
docker-compose -f docker-compose.prod.yml build --no-cache
```

### Nettoyage

#### Docker cleanup

```bash
# Supprimer containers arrêtés
docker container prune -f

# Supprimer images non utilisées
docker image prune -a -f

# Supprimer volumes orphelins
docker volume prune -f

# Nettoyage complet
docker system prune -a --volumes -f
```

#### Database maintenance

```bash
# VACUUM FULL (optimise l'espace disque)
docker exec -it timescaledb psql -U gaveurs_admin -d gaveurs_db -c "VACUUM FULL ANALYZE;"

# Réindexation
docker exec -it timescaledb psql -U gaveurs_admin -d gaveurs_db -c "REINDEX DATABASE gaveurs_db;"

# Vérifier la taille des tables
docker exec -it timescaledb psql -U gaveurs_admin -d gaveurs_db -c "
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
LIMIT 20;
"
```

#### Logs rotation

Les logs sont gérés par Docker avec rotation automatique (voir `docker-compose.prod.yml`) :

```yaml
logging:
  driver: "json-file"
  options:
    max-size: "10m"
    max-file: "3"
```

Nettoyage manuel :
```bash
# Tronquer les logs d'un container
truncate -s 0 $(docker inspect --format='{{.LogPath}}' backend)

# Ou supprimer tous les logs
docker-compose -f docker-compose.prod.yml down
rm -rf /var/lib/docker/containers/*/*-json.log
docker-compose -f docker-compose.prod.yml up -d
```

### Monitoring de l'Espace Disque

```bash
# Créer un script de monitoring
cat > /opt/scripts/disk-monitor.sh << 'EOF'
#!/bin/bash
THRESHOLD=80
USAGE=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')

if [ $USAGE -gt $THRESHOLD ]; then
  echo "Disk usage is above ${THRESHOLD}%: ${USAGE}%" | \
    mail -s "Disk Alert" admin@votredomaine.com
fi
EOF

chmod +x /opt/scripts/disk-monitor.sh

# Ajouter au cron (toutes les heures)
crontab -e
0 * * * * /opt/scripts/disk-monitor.sh
```

---

## Troubleshooting

### Problèmes Courants

#### 1. Backend ne démarre pas

**Symptômes** :
```
backend | Error: Could not connect to database
backend | psycopg2.OperationalError: could not connect to server
```

**Solutions** :
```bash
# Vérifier que TimescaleDB est démarré
docker-compose -f docker-compose.prod.yml ps timescaledb

# Vérifier les logs DB
docker-compose -f docker-compose.prod.yml logs timescaledb

# Vérifier la connexion réseau
docker-compose -f docker-compose.prod.yml exec backend ping timescaledb

# Vérifier les variables d'environnement
docker-compose -f docker-compose.prod.yml exec backend env | grep DATABASE_URL
```

#### 2. Frontend shows 502 Bad Gateway

**Symptômes** :
```
Nginx error: upstream connect error
```

**Solutions** :
```bash
# Vérifier que le backend est démarré
docker-compose -f docker-compose.prod.yml ps backend

# Tester la connexion backend
curl http://localhost:8000/health

# Vérifier la configuration Nginx
docker-compose -f docker-compose.prod.yml exec nginx nginx -t

# Reload Nginx
docker-compose -f docker-compose.prod.yml exec nginx nginx -s reload
```

#### 3. SSL Certificate Issues

**Symptômes** :
```
ERR_CERT_AUTHORITY_INVALID
Certificate has expired
```

**Solutions** :
```bash
# Vérifier l'expiration du certificat
echo | openssl s_client -servername api.votredomaine.com -connect api.votredomaine.com:443 2>/dev/null | openssl x509 -noout -dates

# Renouveler manuellement
docker-compose -f docker-compose.prod.yml run --rm certbot renew

# Forcer le renouvellement
docker-compose -f docker-compose.prod.yml run --rm certbot renew --force-renewal

# Reload Nginx après renouvellement
docker-compose -f docker-compose.prod.yml exec nginx nginx -s reload
```

#### 4. Database Performance Issues

**Symptômes** :
```
Slow queries
Connection pool exhausted
```

**Solutions** :
```bash
# Vérifier les requêtes lentes
docker exec -it timescaledb psql -U gaveurs_admin -d gaveurs_db -c "
SELECT
  pid,
  now() - pg_stat_activity.query_start AS duration,
  query,
  state
FROM pg_stat_activity
WHERE state != 'idle'
  AND now() - pg_stat_activity.query_start > interval '1 second'
ORDER BY duration DESC;
"

# Vérifier le nombre de connexions
docker exec -it timescaledb psql -U gaveurs_admin -d gaveurs_db -c "
SELECT count(*) FROM pg_stat_activity;
"

# Augmenter max_connections (dans docker-compose.prod.yml)
# timescaledb:
#   command: postgres -c max_connections=200

# Redémarrer la DB
docker-compose -f docker-compose.prod.yml restart timescaledb
```

#### 5. WebSocket Connection Fails

**Symptômes** :
```
WebSocket connection to 'wss://api.votredomaine.com/ws/sensors/' failed
```

**Solutions** :
```bash
# Vérifier la configuration Nginx WebSocket
# Doit inclure:
# proxy_http_version 1.1;
# proxy_set_header Upgrade $http_upgrade;
# proxy_set_header Connection "upgrade";

# Tester la connexion WebSocket
curl -i -N \
  -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Version: 13" \
  -H "Sec-WebSocket-Key: test" \
  https://api.votredomaine.com/ws/sensors/

# Devrait retourner: 101 Switching Protocols
```

#### 6. Out of Memory (OOM)

**Symptômes** :
```
Container killed with exit code 137
```

**Solutions** :
```bash
# Vérifier l'utilisation mémoire
docker stats

# Augmenter les limites dans docker-compose.prod.yml
services:
  backend:
    deploy:
      resources:
        limits:
          memory: 4G  # Augmenter de 2G à 4G

# Redémarrer
docker-compose -f docker-compose.prod.yml up -d backend
```

### Logs et Debugging

#### Consulter les logs

```bash
# Tous les services
docker-compose -f docker-compose.prod.yml logs -f

# Service spécifique
docker-compose -f docker-compose.prod.yml logs -f backend

# Dernières 100 lignes
docker-compose -f docker-compose.prod.yml logs --tail=100 backend

# Depuis une date/heure
docker-compose -f docker-compose.prod.yml logs --since="2025-01-15T10:00:00" backend
```

#### Mode debug

```bash
# Activer le mode debug du backend
# Éditer .env.production
DEBUG=true
LOG_LEVEL=DEBUG

# Redémarrer
docker-compose -f docker-compose.prod.yml restart backend

# Vérifier les logs détaillés
docker-compose -f docker-compose.prod.yml logs -f backend
```

#### Entrer dans un container

```bash
# Shell interactif
docker-compose -f docker-compose.prod.yml exec backend bash

# Vérifier les processus
ps aux

# Vérifier les variables d'environnement
env

# Tester la connexion DB
python -c "import asyncpg; print('OK')"
```

### Health Checks

Script de health check complet :

```bash
#!/bin/bash
# /opt/scripts/health-check.sh

echo "=== Gaveurs V3.0 Health Check ==="
echo ""

# 1. Docker services
echo "1. Docker Services:"
docker-compose -f /opt/projet-euralis-gaveurs/docker-compose.prod.yml ps

# 2. Database
echo ""
echo "2. Database Connection:"
docker exec timescaledb pg_isready -U gaveurs_admin

# 3. Backend API
echo ""
echo "3. Backend API:"
curl -s https://api.votredomaine.com/health | jq .

# 4. Frontends
echo ""
echo "4. Frontends:"
curl -s -o /dev/null -w "Euralis: %{http_code}\n" https://euralis.votredomaine.com
curl -s -o /dev/null -w "Gaveurs: %{http_code}\n" https://gaveurs.votredomaine.com
curl -s -o /dev/null -w "SQAL: %{http_code}\n" https://sqal.votredomaine.com

# 5. Keycloak
echo ""
echo "5. Keycloak:"
curl -s -o /dev/null -w "Keycloak: %{http_code}\n" https://auth.votredomaine.com

# 6. Disk Usage
echo ""
echo "6. Disk Usage:"
df -h /

# 7. Memory Usage
echo ""
echo "7. Memory Usage:"
free -h

echo ""
echo "=== Health Check Complete ==="
```

```bash
chmod +x /opt/scripts/health-check.sh

# Exécuter
/opt/scripts/health-check.sh
```

---

## Annexes

### A. Checklist de Déploiement

- [ ] Serveur configuré (Ubuntu 22.04, Docker, Docker Compose)
- [ ] DNS configuré (5 sous-domaines)
- [ ] Firewall configuré (ports 80, 443, 22)
- [ ] `.env.production` créé et sécurisé
- [ ] Secrets générés (SECRET_KEY, JWT_SECRET, GPG key)
- [ ] TimescaleDB démarrée
- [ ] Migrations appliquées
- [ ] Keycloak configuré (realm, clients, rôles, utilisateurs)
- [ ] SSL/TLS configuré (Let's Encrypt)
- [ ] Tous les services démarrés
- [ ] Health check OK
- [ ] Backup automatisé configuré (cron)
- [ ] Monitoring configuré (Prometheus/Grafana)
- [ ] CI/CD configuré (GitHub Secrets)
- [ ] Documentation mise à jour
- [ ] Tests de production effectués

### B. Ports Utilisés

| Service | Port | Protocole | Exposition |
|---------|------|-----------|------------|
| Nginx | 80 | HTTP | Public (redirect HTTPS) |
| Nginx | 443 | HTTPS | Public |
| Backend API | 8000 | HTTP | Interne |
| TimescaleDB | 5432 | PostgreSQL | Interne |
| Redis | 6379 | Redis | Interne |
| Keycloak | 8080 | HTTP | Interne (Nginx proxy) |
| Keycloak DB | 5432 | PostgreSQL | Interne |
| Prometheus | 9090 | HTTP | Interne |
| Grafana | 3003 | HTTP | Interne (Nginx proxy) |
| Loki | 3100 | HTTP | Interne |

### C. Variables d'Environnement Complètes

Voir `.env.production.example` pour la liste complète avec explications.

### D. Contacts et Support

- **Documentation** : `documentation/`
- **Issues GitHub** : https://github.com/votre-org/projet-euralis-gaveurs/issues
- **Email support** : support@votredomaine.com
- **Slack** : #gaveurs-support

---

## Changelog

### v3.0.0 - 2025-01-15
- ✅ Production deployment avec Docker Compose
- ✅ CI/CD pipeline GitHub Actions
- ✅ Backup/restore automatisés avec chiffrement
- ✅ Authentification Keycloak centralisée
- ✅ SSL/TLS avec Let's Encrypt
- ✅ Monitoring Prometheus/Grafana
- ✅ Documentation complète

---

**Document créé le** : 2025-01-15
**Version** : 3.0.0
**Auteur** : Équipe Gaveurs V3.0
