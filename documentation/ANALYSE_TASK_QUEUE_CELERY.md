# Analyse: Task Queue pour Système Gaveurs V3.0

**Date**: 08 Janvier 2026
**Sujet**: Évaluation Celery vs Alternatives pour tâches asynchrones

---

## 🎯 Cas d'Usage Identifiés

Analysons où les tâches asynchrones seraient bénéfiques dans votre système:

### 1. **Tâches ML/Analytics** (⏱️ Longues)

#### Actuellement Synchrones:
```python
# app/ml/symbolic_regression.py
def train_pysr_model():  # Peut prendre 5-30 minutes!
    # Entraînement PySR pour formules optimales

# app/ml/feedback_optimizer.py
def optimize_feeding_curve():  # 2-10 minutes
    # Random Forest sur feedbacks consommateurs

# app/ml/euralis/production_forecasting.py
def train_prophet_model():  # 1-5 minutes
    # Prévisions à 7/30/90 jours

# app/ml/euralis/gaveur_clustering.py
def cluster_gaveurs():  # 1-3 minutes
    # K-Means sur 5 clusters

# app/ml/euralis/anomaly_detection.py
def detect_anomalies():  # 30s-2min
    # Isolation Forest
```

**Problème**: Ces tâches bloquent l'API pendant leur exécution → Timeout utilisateur!

**Solution Celery**: Exécuter en background, retourner task_id immédiatement

### 2. **Agrégations Lourdes** (📊 Données massives)

```python
# Refresh continuous aggregates (peut être long)
SELECT refresh_continuous_aggregate('sqal_hourly_stats');
SELECT refresh_continuous_aggregate('gavage_stats_daily');

# Calculs statistiques multi-lots
- Analyse 22 lots × 14 jours × 2 repas = 616 entrées
- Corrélations sur 1896 gavage_data_lots
- Analyse 30+ sqal_sensor_samples × 64 zones ToF
```

### 3. **Notifications** (📧 Email/SMS)

```python
# app/services/sms_service.py
async def send_sms_alert():
    # Envoi SMS via API externe (Twilio)

# Notifications email (à implémenter)
- Alertes critiques gaveurs
- Rapports hebdomadaires
- Alertes qualité SQAL
```

### 4. **Export Données** (📄 Génération Rapports)

```python
# Exports PDF/Excel lourds
- Rapport complet lot (14 jours × données)
- Export CSV multi-lots pour analyse
- Génération certificats blockchain PDF
```

### 5. **Scheduled Tasks** (⏰ Tâches Périodiques)

```python
# À implémenter:
- Backup automatique quotidien
- Nettoyage anciennes données (retention policies)
- Calcul KPIs hebdomadaires
- Envoi rapports automatiques
- Refresh continuous aggregates horaires
```

---

## 📊 Comparaison Solutions

### Option 1: **Celery** ⭐⭐⭐⭐⭐

#### ✅ Avantages:
1. **Mature et éprouvé** - Utilisé par Instagram, Mozilla, etc.
2. **Brokers multiples** - Redis (déjà installé!), RabbitMQ, SQS
3. **Monitoring intégré** - Flower pour supervision visuelle
4. **Retry automatique** - Gestion erreurs robuste
5. **Scheduling intégré** - Celery Beat pour tâches périodiques
6. **Priorités de tâches** - Queues multiples
7. **Canvas** - Workflows complexes (chain, group, chord)
8. **Backend résultats** - Redis, PostgreSQL, MongoDB

#### ❌ Inconvénients:
1. **Complexité setup** - 3 processus (worker, beat, flower)
2. **Overhead** - Pour tâches très simples
3. **Dépendance broker** - Redis obligatoire (mais déjà présent!)
4. **Pickle par défaut** - Risque sécurité (utiliser JSON)

#### 📦 Stack avec Redis (existant):
```yaml
# docker-compose.yml (extrait)
services:
  redis:  # ✅ Déjà installé!
    image: redis:7-alpine
    ports:
      - "6379:6379"

  celery-worker:  # À ajouter
    build: ./backend-api
    command: celery -A app.tasks.celery_app worker -l info
    depends_on:
      - redis
      - gaveurs_timescaledb
    environment:
      CELERY_BROKER_URL: redis://redis:6379/0
      CELERY_RESULT_BACKEND: redis://redis:6379/0

  celery-beat:  # À ajouter (tâches périodiques)
    build: ./backend-api
    command: celery -A app.tasks.celery_app beat -l info
    depends_on:
      - redis

  flower:  # À ajouter (monitoring)
    build: ./backend-api
    command: celery -A app.tasks.celery_app flower
    ports:
      - "5555:5555"
    depends_on:
      - redis
```

#### 💻 Exemple Code:
```python
# app/tasks/celery_app.py
from celery import Celery

celery_app = Celery(
    'gaveurs',
    broker='redis://redis:6379/0',
    backend='redis://redis:6379/0'
)

celery_app.conf.update(
    task_serializer='json',
    accept_content=['json'],
    result_serializer='json',
    timezone='Europe/Paris',
    enable_utc=True,
)

# app/tasks/ml_tasks.py
from app.tasks.celery_app import celery_app

@celery_app.task(bind=True, max_retries=3)
def train_pysr_model_async(self, lot_id: int):
    """Entraînement PySR en background"""
    try:
        # Logique entraînement
        result = train_pysr_model(lot_id)
        return {"status": "success", "result": result}
    except Exception as exc:
        # Retry après 60s
        raise self.retry(exc=exc, countdown=60)

# app/routers/ml.py
from app.tasks.ml_tasks import train_pysr_model_async

@router.post("/ml/train-pysr/{lot_id}")
async def trigger_pysr_training(lot_id: int):
    # Lancer tâche asynchrone
    task = train_pysr_model_async.delay(lot_id)
    return {
        "task_id": task.id,
        "status": "processing",
        "message": "Training started in background"
    }

@router.get("/ml/task-status/{task_id}")
async def get_task_status(task_id: str):
    task = celery_app.AsyncResult(task_id)
    return {
        "task_id": task_id,
        "status": task.state,
        "result": task.result if task.ready() else None
    }
```

---

### Option 2: **ARQ** ⭐⭐⭐⭐

#### ✅ Avantages:
1. **Async-native** - Conçu pour asyncio/FastAPI
2. **Simple** - Moins de code boilerplate que Celery
3. **Redis only** - Pas de choix broker complexe
4. **Type hints** - Support Python moderne
5. **Léger** - Overhead minimal

#### ❌ Inconvénients:
1. **Jeune** - Moins mature que Celery
2. **Communauté petite** - Moins de ressources
3. **Pas de Flower** - Monitoring DIY
4. **Moins de features** - Pas de canvas, moins de retry options

#### 💻 Exemple Code:
```python
# app/tasks/arq_worker.py
from arq import create_pool
from arq.connections import RedisSettings

async def train_pysr_model_async(ctx, lot_id: int):
    """Entraînement PySR en background"""
    result = await train_pysr_model(lot_id)
    return result

class WorkerSettings:
    redis_settings = RedisSettings(host='redis', port=6379)
    functions = [train_pysr_model_async]

# app/routers/ml.py
from arq import create_pool

@router.post("/ml/train-pysr/{lot_id}")
async def trigger_pysr_training(lot_id: int):
    redis = await create_pool(RedisSettings(host='redis'))
    job = await redis.enqueue_job('train_pysr_model_async', lot_id)
    return {"job_id": job.job_id, "status": "enqueued"}
```

---

### Option 3: **RQ (Redis Queue)** ⭐⭐⭐

#### ✅ Avantages:
1. **Simple** - API minimaliste
2. **Redis only** - Comme ARQ
3. **RQ Dashboard** - UI monitoring simple
4. **Léger** - Pas de complexité Celery

#### ❌ Inconvénients:
1. **Pas async** - Pas idéal pour FastAPI
2. **Features limitées** - Pas de scheduling natif
3. **Communauté moyenne** - Moins actif

---

### Option 4: **FastAPI BackgroundTasks** ⭐⭐

#### ✅ Avantages:
1. **Natif FastAPI** - Aucune dépendance
2. **Très simple** - 2 lignes de code
3. **Pas de broker** - Pas d'infra supplémentaire

#### ❌ Inconvénients:
1. **Pas de persistence** - Si server restart, tâches perdues
2. **Pas de retry** - Gestion erreurs manuelle
3. **Pas de monitoring** - Visibilité nulle
4. **Pas de distribution** - Un seul worker (le backend)
5. **Timeout** - Limité à durée requête HTTP

#### 💻 Exemple Code:
```python
from fastapi import BackgroundTasks

@router.post("/ml/train-pysr/{lot_id}")
async def trigger_pysr_training(
    lot_id: int,
    background_tasks: BackgroundTasks
):
    background_tasks.add_task(train_pysr_model, lot_id)
    return {"status": "training started"}
```

**Usage**: Uniquement pour tâches **courtes** (<30s) et **non-critiques**

---

### Option 5: **Dramatiq** ⭐⭐⭐⭐

#### ✅ Avantages:
1. **Simple** - Entre ARQ et Celery
2. **Brokers multiples** - Redis, RabbitMQ
3. **Retry robuste** - Gestion erreurs avancée
4. **Monitoring** - Prometheus metrics

#### ❌ Inconvénients:
1. **Pas async** - Comme Celery
2. **Moins populaire** - Communauté plus petite que Celery

---

## 🏆 Recommandation

### **Pour Votre Système: Celery** ✅

#### Pourquoi Celery?

1. **Redis déjà installé** ✅
   - Broker prêt à l'emploi
   - Pas d'infra supplémentaire

2. **Cas d'usage variés** ✅
   - ML long (5-30 min)
   - Scheduled tasks (Celery Beat)
   - Workflows complexes (chain, group)
   - Monitoring (Flower)

3. **Production-ready** ✅
   - Utilisé par millions d'apps
   - Documentation exhaustive
   - Communauté active

4. **Évolutivité** ✅
   - Workers multiples facilement
   - Queues prioritaires
   - Distribution sur plusieurs machines

#### Architecture Recommandée:

```
┌─────────────────────────────────────────────────────┐
│                   FastAPI Backend                   │
│  (Routes API - Création tâches Celery)             │
└─────────────────────────────────────────────────────┘
                        ↓
                   [Redis Broker]
                   (Port 6379) ✅ Déjà installé
                        ↓
        ┌───────────────┴───────────────┐
        ↓                               ↓
┌────────────────┐            ┌────────────────┐
│ Celery Workers │            │  Celery Beat   │
│  (3 workers)   │            │  (Scheduler)   │
│                │            │                │
│ - ML Tasks     │            │ - Hourly jobs  │
│ - Exports      │            │ - Daily backup │
│ - Notifications│            │ - Weekly KPIs  │
└────────────────┘            └────────────────┘
        ↓                               ↓
   [Redis Results]              [Scheduled Tasks]
        ↓
┌─────────────────┐
│     Flower      │
│  (Monitoring)   │
│  Port 5555      │
└─────────────────┘
```

---

## 📋 Plan d'Implémentation Celery

### Phase 1: Setup Base (2h)

```bash
# 1. Installer dépendances
pip install celery[redis] flower

# 2. Créer structure
backend-api/
  app/
    tasks/
      __init__.py
      celery_app.py       # Config Celery
      ml_tasks.py         # Tâches ML
      export_tasks.py     # Tâches exports
      notification_tasks.py # Tâches notifications
      scheduled_tasks.py  # Tâches périodiques
```

```python
# app/tasks/celery_app.py
from celery import Celery
from celery.schedules import crontab

celery_app = Celery(
    'gaveurs',
    broker='redis://redis:6379/0',
    backend='redis://redis:6379/1',  # DB différente pour résultats
    include=[
        'app.tasks.ml_tasks',
        'app.tasks.export_tasks',
        'app.tasks.notification_tasks',
        'app.tasks.scheduled_tasks',
    ]
)

celery_app.conf.update(
    task_serializer='json',
    accept_content=['json'],
    result_serializer='json',
    timezone='Europe/Paris',
    enable_utc=True,
    task_track_started=True,
    task_time_limit=3600,  # 1h max par tâche
    task_soft_time_limit=3300,  # Warning à 55min
    worker_prefetch_multiplier=1,  # Une tâche à la fois (pour ML)

    # Tâches périodiques (Celery Beat)
    beat_schedule={
        'refresh-continuous-aggregates-hourly': {
            'task': 'app.tasks.scheduled_tasks.refresh_aggregates',
            'schedule': crontab(minute=0),  # Toutes les heures
        },
        'backup-database-daily': {
            'task': 'app.tasks.scheduled_tasks.backup_database',
            'schedule': crontab(hour=3, minute=0),  # 3h du matin
        },
        'generate-weekly-reports': {
            'task': 'app.tasks.scheduled_tasks.generate_weekly_reports',
            'schedule': crontab(day_of_week=1, hour=8, minute=0),  # Lundi 8h
        },
    },
)
```

### Phase 2: Tâches ML (3h)

```python
# app/tasks/ml_tasks.py
from app.tasks.celery_app import celery_app
from app.ml.symbolic_regression import train_pysr_model
from app.ml.feedback_optimizer import optimize_feeding_curve
import logging

logger = logging.getLogger(__name__)

@celery_app.task(bind=True, max_retries=3, time_limit=1800)
def train_pysr_async(self, lot_id: int):
    """Entraînement PySR (peut prendre 30min)"""
    try:
        logger.info(f"Starting PySR training for lot {lot_id}")
        result = train_pysr_model(lot_id)
        logger.info(f"PySR training completed for lot {lot_id}")
        return {
            "status": "success",
            "lot_id": lot_id,
            "formula": result["formula"],
            "r2_score": result["r2_score"]
        }
    except Exception as exc:
        logger.error(f"PySR training failed for lot {lot_id}: {exc}")
        raise self.retry(exc=exc, countdown=300)  # Retry après 5min

@celery_app.task(bind=True, max_retries=2, time_limit=600)
def optimize_feeding_curve_async(self, lot_id: int):
    """Optimisation courbe gavage basée sur feedbacks"""
    try:
        logger.info(f"Optimizing feeding curve for lot {lot_id}")
        result = optimize_feeding_curve(lot_id)
        return {
            "status": "success",
            "lot_id": lot_id,
            "new_curve": result["optimized_curve"],
            "improvement": result["expected_improvement"]
        }
    except Exception as exc:
        logger.error(f"Feeding curve optimization failed: {exc}")
        raise self.retry(exc=exc, countdown=180)

@celery_app.task(time_limit=300)
def detect_anomalies_async():
    """Détection anomalies Isolation Forest"""
    from app.ml.euralis.anomaly_detection import detect_anomalies
    return detect_anomalies()

@celery_app.task(time_limit=600)
def cluster_gaveurs_async():
    """Clustering K-Means des gaveurs"""
    from app.ml.euralis.gaveur_clustering import cluster_gaveurs
    return cluster_gaveurs()
```

### Phase 3: Routes API (1h)

```python
# app/routers/ml.py
from fastapi import APIRouter, HTTPException
from app.tasks.ml_tasks import train_pysr_async, optimize_feeding_curve_async
from app.tasks.celery_app import celery_app

router = APIRouter(prefix="/ml", tags=["Machine Learning"])

@router.post("/train-pysr/{lot_id}")
async def trigger_pysr_training(lot_id: int):
    """Lance entraînement PySR en background"""
    task = train_pysr_async.delay(lot_id)
    return {
        "task_id": task.id,
        "status": "processing",
        "message": f"PySR training started for lot {lot_id}",
        "check_status_url": f"/ml/task-status/{task.id}"
    }

@router.post("/optimize-feeding-curve/{lot_id}")
async def trigger_optimization(lot_id: int):
    """Optimise courbe gavage en background"""
    task = optimize_feeding_curve_async.delay(lot_id)
    return {
        "task_id": task.id,
        "status": "processing"
    }

@router.get("/task-status/{task_id}")
async def get_task_status(task_id: str):
    """Récupère le statut d'une tâche"""
    task = celery_app.AsyncResult(task_id)

    if task.state == 'PENDING':
        response = {
            "state": task.state,
            "status": "Task is waiting in queue"
        }
    elif task.state == 'STARTED':
        response = {
            "state": task.state,
            "status": "Task is running"
        }
    elif task.state == 'SUCCESS':
        response = {
            "state": task.state,
            "status": "Task completed successfully",
            "result": task.result
        }
    elif task.state == 'FAILURE':
        response = {
            "state": task.state,
            "status": "Task failed",
            "error": str(task.info)
        }
    else:
        response = {
            "state": task.state,
            "status": str(task.info)
        }

    return response

@router.delete("/task/{task_id}")
async def cancel_task(task_id: str):
    """Annule une tâche en cours"""
    celery_app.control.revoke(task_id, terminate=True)
    return {"status": "cancelled", "task_id": task_id}
```

### Phase 4: Docker Compose (30min)

```yaml
# docker-compose.yml (ajouter)
services:
  # ... services existants ...

  celery-worker:
    build:
      context: ./backend-api
      dockerfile: Dockerfile
    command: celery -A app.tasks.celery_app worker -l info -c 3
    environment:
      - DATABASE_URL=postgresql://gaveurs_admin:gaveurs_secure_2024@gaveurs_timescaledb:5432/gaveurs_db
      - CELERY_BROKER_URL=redis://gaveurs_redis:6379/0
      - CELERY_RESULT_BACKEND=redis://gaveurs_redis:6379/1
    depends_on:
      - gaveurs_redis
      - gaveurs_timescaledb
    networks:
      - gaveurs_network
    restart: unless-stopped

  celery-beat:
    build:
      context: ./backend-api
      dockerfile: Dockerfile
    command: celery -A app.tasks.celery_app beat -l info
    environment:
      - CELERY_BROKER_URL=redis://gaveurs_redis:6379/0
    depends_on:
      - gaveurs_redis
    networks:
      - gaveurs_network
    restart: unless-stopped

  flower:
    build:
      context: ./backend-api
      dockerfile: Dockerfile
    command: celery -A app.tasks.celery_app flower --port=5555
    ports:
      - "5555:5555"
    environment:
      - CELERY_BROKER_URL=redis://gaveurs_redis:6379/0
      - CELERY_RESULT_BACKEND=redis://gaveurs_redis:6379/1
    depends_on:
      - gaveurs_redis
      - celery-worker
    networks:
      - gaveurs_network
    restart: unless-stopped
```

### Phase 5: Monitoring Flower (15min)

Accès: http://localhost:5555

Features:
- ✅ Voir tâches en cours
- ✅ Historique tâches
- ✅ Statistiques workers
- ✅ Graphes temps d'exécution
- ✅ Contrôle workers (pause/resume/shutdown)

---

## 🎯 Cas d'Usage Concrets

### 1. Entraînement ML Long

```python
# Frontend envoie requête
POST /api/ml/train-pysr/3472

# Backend répond immédiatement
{
  "task_id": "abc123",
  "status": "processing",
  "message": "Training started"
}

# Frontend poll status toutes les 5s
GET /api/ml/task-status/abc123
→ {"state": "STARTED", "status": "Task is running"}

# 10 minutes plus tard
GET /api/ml/task-status/abc123
→ {
  "state": "SUCCESS",
  "result": {
    "formula": "ITM = 0.5*dose + 0.3*poids - 2.1",
    "r2_score": 0.89
  }
}
```

### 2. Export Rapport PDF

```python
@celery_app.task
def generate_lot_report_pdf(lot_id: int):
    """Génère rapport PDF complet d'un lot"""
    # Récupère 14 jours × données
    # Génère graphiques
    # Crée PDF 20+ pages
    # Upload vers S3/stockage
    return {"pdf_url": "https://..."}

# Route API
@router.post("/lots/{lot_id}/export-pdf")
async def export_lot_pdf(lot_id: int):
    task = generate_lot_report_pdf.delay(lot_id)
    return {
        "task_id": task.id,
        "message": "PDF generation started. You'll receive an email when ready."
    }
```

### 3. Tâches Périodiques

```python
# Refresh continuous aggregates toutes les heures
@celery_app.task
def refresh_aggregates():
    conn = get_db_connection()
    conn.execute("SELECT refresh_continuous_aggregate('sqal_hourly_stats')")
    conn.execute("SELECT refresh_continuous_aggregate('gavage_stats_daily')")

# Backup quotidien
@celery_app.task
def backup_database():
    subprocess.run([
        "pg_dump",
        "-U", "gaveurs_admin",
        "gaveurs_db",
        "-f", f"/backups/auto_backup_{datetime.now().strftime('%Y%m%d')}.sql"
    ])
```

---

## 💰 Coûts/Ressources

### Ressources Supplémentaires:

1. **Redis**: ✅ Déjà installé (pas de coût)
2. **Celery Workers**:
   - 3 workers × ~500 MB RAM = 1.5 GB
   - CPU variable (selon tâches ML)
3. **Celery Beat**: ~100 MB RAM
4. **Flower**: ~200 MB RAM

**Total supplémentaire**: ~1.8 GB RAM

---

## ✅ Conclusion

### **Recommandation: Implémenter Celery**

**Raisons**:
1. ✅ Redis déjà installé
2. ✅ Cas d'usage variés (ML, exports, scheduling)
3. ✅ Production-ready
4. ✅ Monitoring Flower excellent
5. ✅ Évolutif facilement

**Alternative légère**: ARQ si vous voulez rester 100% async, mais moins de features.

**Alternative simple**: FastAPI BackgroundTasks UNIQUEMENT pour tâches <30s non-critiques.

---

**Voulez-vous que je procède à l'implémentation de Celery?**

