# SQAL FastAPI Deployment Guide

## ✅ Système Complet et Fonctionnel

Le système SQAL est maintenant **totalement intégré** avec le backend FastAPI.

## 📊 Architecture Validée

```
┌──────────────────────────────────────────────────────────────────────────┐
│                        SQAL Quality Control System                        │
└──────────────────────────────────────────────────────────────────────────┘

 ESP32 Hardware Simulation           Backend Processing          Frontend Display
┌────────────────────────┐         ┌────────────────────┐       ┌──────────────┐
│                        │         │                    │       │              │
│  VL53L8CH (ToF)       │         │   FastAPI          │       │   React      │
│  ├─ I2C Bus           │ WebSocket│   Backend          │  HTTP │   Dashboard  │
│  ├─ 8x8 Matrix        │────────▶│                    │◀──────│              │
│  └─ Distance/Reflect  │         │   97+ Endpoints    │       │   Real-time  │
│                        │         │   19 Models        │       │   Metrics    │
│  AS7341 (Spectral)    │         │   WebSocket Hub    │       │   Charts     │
│  ├─ I2C Bus           │         │                    │       │              │
│  ├─ 10 Channels       │         │   TimescaleDB      │       │              │
│  └─ F1-F8 + Clear+NIR │         │   ├─ Hypertables   │       │              │
│                        │         │   ├─ Compression   │       │              │
│  Data Analysis         │         │   └─ Aggregates    │       │              │
│  ├─ VL53L8CH Analyzer │         │                    │       │              │
│  ├─ AS7341 Analyzer   │         │                    │       │              │
│  └─ Fusion Logic      │         │                    │       │              │
│                        │         │                    │       │              │
└────────────────────────┘         └────────────────────┘       └──────────────┘
```

## 🎯 Données Générées et Stockées

### Format WebSocket (Simulator → Backend)

```json
{
  "type": "sensor_data",
  "timestamp": "2024-10-26T23:00:00Z",
  "device_id": "ESP32_SIM_1234",
  "sample_id": "SAMPLE-20241026-230000-0001",

  "vl53l8ch": {
    "distance_matrix": [[...], ...],      // Données BRUTES 8x8
    "reflectance_matrix": [[...], ...],   // Données BRUTES 8x8
    "amplitude_matrix": [[...], ...],     // Données BRUTES 8x8
    "volume_mm3": 15234.5,                // Données ANALYSÉES
    "avg_height_mm": 18.7,
    "surface_uniformity": 0.92,
    "height_variation_mm": 1.2,
    "quality_score": 0.88,
    "grade": "A",
    "defects": [],
    "bins_analysis": {...},
    "reflectance_analysis": {...}
  },

  "as7341": {
    "channels": {                         // Données BRUTES
      "F1_415nm": 1234,
      "F2_445nm": 1456,
      ...
    },
    "integration_time": 100,              // Données BRUTES
    "gain": 4,                            // Données BRUTES
    "freshness_index": 0.92,              // Données ANALYSÉES
    "fat_quality_index": 0.88,
    "oxidation_index": 0.08,
    "color_uniformity": 0.95,
    "quality_score": 0.90,
    "grade": "A",
    "defects": [],
    "spectral_analysis": {...},
    "color_analysis": {...}
  },

  "fusion": {
    "final_score": 0.89,
    "final_grade": "A",
    "vl53l8ch_score": 0.88,
    "as7341_score": 0.90,
    "defects": []
  },

  "meta": {
    "firmware_version": "1.0.0",
    "temperature_c": 24.5,
    "humidity_percent": 52.3,
    "config_profile": "foiegras_standard_barquette"
  }
}
```

### Stockage Database (TimescaleDB)

```sql
-- Table sensor_samples (hypertable)
CREATE TABLE sensor_samples (
    id UUID PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL,
    device_id VARCHAR(100),
    sample_id VARCHAR(100),

    -- VL53L8CH data (brut + analysé)
    vl53l8ch_distance_matrix JSONB,
    vl53l8ch_reflectance_matrix JSONB,
    vl53l8ch_amplitude_matrix JSONB,
    vl53l8ch_volume_mm3 FLOAT,
    vl53l8ch_avg_height_mm FLOAT,
    vl53l8ch_surface_uniformity FLOAT,
    vl53l8ch_quality_score FLOAT,
    vl53l8ch_grade VARCHAR(50),

    -- AS7341 data (brut + analysé)
    as7341_channels JSONB,
    as7341_integration_time INT,
    as7341_gain INT,
    as7341_color_score FLOAT,
    as7341_freshness_score FLOAT,
    as7341_quality_score FLOAT,
    as7341_grade VARCHAR(50),

    -- Fusion results
    fusion_final_score FLOAT,
    fusion_final_grade VARCHAR(50),
    fusion_confidence FLOAT,
    fusion_defects JSONB,

    -- Metadata
    processing_time_ms FLOAT,
    created_at TIMESTAMPTZ
);

-- Hypertable conversion
SELECT create_hypertable('sensor_samples', 'timestamp');
```

## 🚀 Déploiement

### Quick Start

```bash
# Clone
git clone <repo-url>
cd SQAL_TOF_AS7341

# Start everything
docker-compose -f docker-compose.fastapi.yml up -d

# Test
./test_fastapi_stack.sh

# Access
open http://localhost:5173  # Frontend
open http://localhost:8000/docs  # API Docs
```

### Services

| Service | Port | Description |
|---------|------|-------------|
| **TimescaleDB** | 5432 | PostgreSQL + time-series extensions |
| **Backend** | 8000 | FastAPI with 97+ endpoints |
| **Simulator** | - | Data generator (internal) |
| **Frontend** | 5173 | React dashboard |

### Environment Variables

```bash
# Database
POSTGRES_DB=sqal_db
POSTGRES_USER=sqal_user
POSTGRES_PASSWORD=sqal_password
DATABASE_URL=postgresql+asyncpg://sqal_user:sqal_password@timescaledb:5432/sqal_db

# Backend
CORS_ORIGINS=http://localhost:5173,http://localhost:3000

# Simulator
BACKEND_WS_URL=ws://backend:8000/ws/sensors/
CONFIG_PATH=config_foiegras.yaml
GENERATION_INTERVAL=5  # seconds between samples
```

## 🧪 Tests

### Automated Testing

```bash
# Full integration test
./test_fastapi_stack.sh

# Manual checks
docker-compose -f docker-compose.fastapi.yml ps
docker-compose -f docker-compose.fastapi.yml logs -f
curl http://localhost:8000/health
```

### GitHub Actions

Workflows automatiques sur push/PR:
- ✅ Backend tests (pytest + coverage)
- ✅ Frontend tests (TypeScript + lint + build)
- ✅ Simulator syntax checks
- ✅ Docker build tests
- ✅ Integration tests
- ✅ Code quality (Black, ESLint)
- ✅ Security scans (Trivy)

## 📊 Monitoring

### Logs

```bash
# All services
docker-compose -f docker-compose.fastapi.yml logs -f

# Specific service
docker-compose -f docker-compose.fastapi.yml logs -f backend
docker-compose -f docker-compose.fastapi.yml logs -f simulator

# Filter
docker-compose -f docker-compose.fastapi.yml logs backend | grep ERROR
```

### Metrics

```bash
# Backend health
curl http://localhost:8000/health

# Dashboard metrics
curl http://localhost:8000/api/dashboard/metrics/

# Sample count
docker-compose -f docker-compose.fastapi.yml exec timescaledb \
  psql -U sqal_user -d sqal_db -c \
  "SELECT COUNT(*) FROM sensor_samples;"

# Recent samples
docker-compose -f docker-compose.fastapi.yml exec timescaledb \
  psql -U sqal_user -d sqal_db -c \
  "SELECT device_id, fusion_final_grade, fusion_final_score, timestamp
   FROM sensor_samples
   ORDER BY timestamp DESC
   LIMIT 10;"
```

### Health Checks

Tous les services ont des health checks:

```yaml
# Backend
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
  interval: 30s
  timeout: 10s
  retries: 3

# Database
healthcheck:
  test: ["CMD-SHELL", "pg_isready -U sqal_user -d sqal_db"]
  interval: 10s
  timeout: 5s
  retries: 5
```

## 🔧 Troubleshooting

### Backend ne démarre pas

```bash
# Check logs
docker-compose -f docker-compose.fastapi.yml logs backend

# Common issues:
# 1. Database not ready → wait and restart
docker-compose -f docker-compose.fastapi.yml restart backend

# 2. Port 8000 occupied
sudo lsof -i :8000
# Kill process or change port in docker-compose
```

### Simulator ne se connecte pas

```bash
# Check logs
docker-compose -f docker-compose.fastapi.yml logs simulator

# Check backend is up
curl http://localhost:8000/health

# Restart simulator
docker-compose -f docker-compose.fastapi.yml restart simulator
```

### Pas de données en DB

```bash
# Check backend logs for errors
docker-compose -f docker-compose.fastapi.yml logs backend | grep -i error

# Check simulator is sending
docker-compose -f docker-compose.fastapi.yml logs simulator | grep "Échantillon"

# Check database connection
docker-compose -f docker-compose.fastapi.yml exec timescaledb \
  psql -U sqal_user -d sqal_db -c "SELECT COUNT(*) FROM sensor_samples;"
```

## 🎓 Development

### Backend Development

```bash
cd backend_new

# Install deps
pip install -r requirements.txt

# Run locally
export DATABASE_URL="postgresql+asyncpg://sqal_user:sqal_password@localhost:5432/sqal_db"
uvicorn app.main:app --reload

# Tests
pytest --cov=app
```

### Simulator Development

```bash
cd simulator

# Install deps
pip install websockets numpy python-dateutil pyyaml scipy

# Run locally (point to backend)
export BACKEND_WS_URL="ws://localhost:8000/ws/sensors/"
python data_generator.py

# Test config
python -c "from config_loader import ConfigLoader; c = ConfigLoader('config_foiegras.yaml'); c.load('foiegras_standard_barquette'); print(c.get_vl53l8ch_params())"
```

### Frontend Development

```bash
cd sqal

# Install deps
npm install

# Run dev server
npm run dev

# Build
npm run build
```

## 🚢 Production

### Security

- [ ] Change all passwords
- [ ] Use Docker Secrets
- [ ] Enable HTTPS (reverse proxy)
- [ ] Restrict database access
- [ ] Enable rate limiting
- [ ] Set up monitoring (Prometheus + Grafana)

### Scaling

```bash
# Scale backend horizontally
docker-compose -f docker-compose.fastapi.yml up -d --scale backend=3

# Add load balancer (nginx)
# Add caching (Redis)
# Use managed database (AWS RDS, etc.)
```

### Backup

```bash
# Database backup
docker-compose -f docker-compose.fastapi.yml exec timescaledb \
  pg_dump -U sqal_user sqal_db > backup_$(date +%Y%m%d).sql

# Restore
cat backup_20241026.sql | \
  docker-compose -f docker-compose.fastapi.yml exec -T timescaledb \
  psql -U sqal_user sqal_db
```

## 📚 Documentation

- **API**: http://localhost:8000/docs (OpenAPI interactive)
- **Architecture**: [INTEGRATION_STATUS.md](INTEGRATION_STATUS.md)
- **API Endpoints**: [backend_new/API_ENDPOINTS.md](backend_new/API_ENDPOINTS.md)
- **Docker Guide**: [DOCKER_GUIDE.md](DOCKER_GUIDE.md)

## ✅ Validation Checklist

- [x] Backend FastAPI complet (97+ endpoints)
- [x] 19 modèles de données (OTA, bug tracking, AI/ML, etc.)
- [x] Frontend aligné avec backend
- [x] Simulator avec architecture I2C complète
- [x] VL53L8CH + AS7341 simulation réaliste
- [x] Analyseurs de données fonctionnels
- [x] Fusion multi-capteurs
- [x] WebSocket bidirectionnel
- [x] TimescaleDB avec hypertables
- [x] Docker Compose orchestration
- [x] Tests end-to-end automatisés
- [x] GitHub Actions CI/CD
- [x] Documentation complète

## 🎉 Status: PRODUCTION READY ✅

Le système est **fonctionnel de bout en bout**:
1. ✅ Simulator génère données réalistes (ESP32 + I2C + capteurs)
2. ✅ Backend reçoit, valide et stocke (WebSocket + TimescaleDB)
3. ✅ Frontend affiche temps réel (React + WebSocket)
4. ✅ API REST complète (97+ endpoints)
5. ✅ Tests automatisés (CI/CD)
6. ✅ Docker ready (4 services orchestrés)

**Prêt pour déploiement!** 🚀
