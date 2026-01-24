# Guide Complet Celery - Tâches Asynchrones

**Date**: 08 Janvier 2026
**Version**: 1.0

---

## 📋 Vue d'Ensemble

Celery est un système de **task queue** distribué permettant d'exécuter des tâches longues en arrière-plan sans bloquer l'API FastAPI.

### Pourquoi Celery ?

**Problèmes résolus**:
- ✅ Entraînements ML longs (PySR: 5-30 min, Prophet: 1-5 min)
- ✅ Génération PDF/CSV lourds (10-60 secondes)
- ✅ Envoi notifications SMS/Email (2-5 secondes)
- ✅ Tâches planifiées (backups quotidiens, refresh aggregates, KPIs hebdomadaires)

**Avantages vs alternatives**:
- Redis déjà installé (pas besoin de RabbitMQ)
- Production-ready (robuste, scalable)
- Monitoring intégré (Flower)
- Retry automatique + gestion erreurs
- Beat scheduler pour tâches périodiques

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT REQUEST                            │
│                  (Frontend → FastAPI Backend)                   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                     FASTAPI BACKEND                             │
│  POST /api/tasks/ml/pysr/train?lot_id=123                      │
│  → Déclenche tâche Celery                                      │
│  → Retourne immédiatement: {"task_id": "abc-123"}              │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                        REDIS BROKER                              │
│  Queue: ml_heavy                                                │
│  Message: {"task": "train_pysr_async", "args": [123]}          │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                     CELERY WORKER                               │
│  Récupère message depuis queue                                 │
│  Exécute: train_pysr_model(lot_id=123)                         │
│  Durée: 5-30 minutes                                           │
│  Stocke résultat dans Redis                                    │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                   REDIS RESULT BACKEND                          │
│  task_id: "abc-123"                                             │
│  status: "SUCCESS"                                              │
│  result: {"formula": "...", "r2_score": 0.95}                  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                     CLIENT POLLING                              │
│  GET /api/tasks/status/abc-123                                 │
│  → {"status": "SUCCESS", "result": {...}}                      │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📦 Composants

### 1. Celery Worker
**Rôle**: Exécute les tâches asynchrones
**Container**: `gaveurs_celery_worker`
**Commande**: `celery -A app.tasks.celery_app worker --concurrency=4`
**Queues**: `ml_heavy`, `ml_light`, `exports`, `notifications`, `default`

### 2. Celery Beat
**Rôle**: Scheduler pour tâches périodiques
**Container**: `gaveurs_celery_beat`
**Commande**: `celery -A app.tasks.celery_app beat`
**Planification**:
- Toutes les heures: Refresh continuous aggregates
- Quotidien 3h: Backup database
- Quotidien 4h: Cleanup old tasks
- Quotidien 18h: Daily summary emails
- Hebdomadaire lundi 6h: Weekly reports
- Hebdomadaire lundi 7h: Weekly KPIs
- Mensuel 1er à 2h: ML models retraining

### 3. Flower
**Rôle**: UI monitoring des tâches Celery
**Container**: `gaveurs_flower`
**URL**: http://localhost:5555
**Auth**: `admin:gaveurs_flower_2024`

### 4. Redis
**Rôle**: Broker (queues) + Result backend (résultats)
**Container**: `gaveurs_redis`
**Databases**:
- DB 0: Broker (messages queue)
- DB 1: Result backend (résultats tâches)

---

## 📂 Structure Fichiers

```
backend-api/
├── app/
│   ├── tasks/
│   │   ├── __init__.py                    # Package init
│   │   ├── celery_app.py                  # Configuration Celery
│   │   ├── ml_tasks.py                    # Tâches ML (9 tâches)
│   │   ├── export_tasks.py                # Tâches export (8 tâches)
│   │   ├── notification_tasks.py          # Tâches notifications (6 tâches)
│   │   └── scheduled_tasks.py             # Tâches planifiées (7 tâches)
│   │
│   ├── routers/
│   │   └── tasks.py                       # API routes gestion tâches
│   │
│   └── main.py                            # Include router tasks
│
└── requirements.txt                       # Dépendances Celery
```

---

## 🎯 Tâches Implémentées

### ML Tasks (9 tâches)

| Tâche | Fonction | Durée | Queue |
|-------|----------|-------|-------|
| PySR Training | `train_pysr_async(lot_id)` | 5-30 min | ml_heavy |
| Feeding Curve Optimization | `optimize_feeding_curve_async(lot_id)` | 2-10 min | ml_heavy |
| Prophet Forecasting | `train_prophet_async(site_code, horizon_days)` | 1-5 min | ml_light |
| Gaveur Clustering | `cluster_gaveurs_async()` | 1-3 min | ml_light |
| Anomaly Detection | `detect_anomalies_async(site_code)` | 30s-2min | ml_light |
| Anomaly Detection (periodic) | `detect_anomalies_periodic()` | 2-5 min | ml_light |
| Abattage Planning Optimization | `optimize_abattage_planning_async(date_debut, date_fin)` | 2-10 min | ml_heavy |
| Full ML Retraining | `retrain_all_ml_models_async()` | 30-60 min | ml_heavy |

### Export Tasks (8 tâches)

| Tâche | Fonction | Durée | Queue |
|-------|----------|-------|-------|
| Lot PDF Report | `generate_lot_pdf_report(lot_id, report_type)` | 10-60s | exports |
| Site PDF Report | `generate_site_pdf_report(site_code, date_debut, date_fin)` | 20-90s | exports |
| Gavage CSV Export | `export_gavage_data_csv(lot_id, date_debut, date_fin)` | 5-30s | exports |
| SQAL CSV Export | `export_sqal_data_csv(lot_id, date_debut, date_fin)` | 5-30s | exports |
| Consumer Feedbacks CSV Export | `export_consumer_feedbacks_csv(date_debut, date_fin)` | 5-20s | exports |
| Blockchain Certificate | `generate_blockchain_certificate(lot_id, certificate_type)` | 2-10s | exports |
| Batch Lots CSV Export | `batch_export_lots_csv(lot_ids)` | 10-60s | exports |
| Weekly Reports Generation | `weekly_reports_generation()` | 2-5 min | exports |

### Notification Tasks (6 tâches)

| Tâche | Fonction | Durée | Queue |
|-------|----------|-------|-------|
| SMS Alert | `send_sms_alert(phone, message, priority)` | 2-5s | notifications |
| Email Notification | `send_email_notification(to_email, subject, body_html)` | 1-3s | notifications |
| Anomaly Alert | `send_anomaly_alert(site_code, anomalies)` | 5-10s | notifications |
| Lot Completion Notification | `send_lot_completion_notification(lot_id)` | 3-5s | notifications |
| Daily Summary Reports | `send_daily_summary_reports()` | 20-60s | notifications |
| Consumer Feedback Acknowledgment | `send_consumer_feedback_acknowledgment(feedback_id)` | 2-3s | notifications |

### Scheduled Tasks (7 tâches)

| Tâche | Fonction | Schedule | Durée |
|-------|----------|----------|-------|
| Refresh Continuous Aggregates | `refresh_continuous_aggregates()` | Hourly | 2-5 min |
| Database Backup | `backup_database_task()` | Daily 3h | 5-10 min |
| Cleanup Old Tasks | `cleanup_old_celery_tasks()` | Daily 4h | 1-3 min |
| Weekly KPIs Calculation | `calculate_weekly_kpis()` | Monday 7h | 5-30 min |
| Monthly ML Retraining | `monthly_ml_models_retraining()` | 1st of month 2h | 30-60 min |
| Cleanup Old Sensor Data | `cleanup_old_sensor_data()` | 1st of month 5h | 2-5 min |
| Health Check Periodic | `health_check_periodic()` | Every 6h | 10-30s |

---

## 🚀 Utilisation

### Démarrage Services

```bash
# Démarrer tous les services (incluant Celery)
docker-compose up -d

# Vérifier statut
docker-compose ps

# Services Celery:
# - gaveurs_celery_worker   (worker)
# - gaveurs_celery_beat     (scheduler)
# - gaveurs_flower          (monitoring)
```

### Déclencher une Tâche via API

#### Exemple 1: Entraînement PySR
```bash
# Déclencher entraînement
curl -X POST "http://localhost:8000/api/tasks/ml/pysr/train?lot_id=3472"

# Réponse:
{
  "status": "submitted",
  "task_id": "abc-123-def-456",
  "lot_id": 3472,
  "message": "PySR training started"
}

# Vérifier statut
curl "http://localhost:8000/api/tasks/status/abc-123-def-456"

# Réponse (en cours):
{
  "task_id": "abc-123-def-456",
  "task_name": "train_pysr_async",
  "status": "STARTED",
  "progress": 45,
  "started_at": "2026-01-08T12:30:00"
}

# Réponse (terminé):
{
  "task_id": "abc-123-def-456",
  "task_name": "train_pysr_async",
  "status": "SUCCESS",
  "result": {
    "status": "success",
    "lot_id": 3472,
    "formula": "ITM = 0.85 * poids_final - 0.12 * dose_totale + 42.3",
    "r2_score": 0.947,
    "variables": ["poids_final", "dose_totale"],
    "complexity": 7
  },
  "completed_at": "2026-01-08T12:45:23"
}
```

#### Exemple 2: Export PDF
```bash
# Générer rapport PDF pour un lot
curl -X POST "http://localhost:8000/api/tasks/export/pdf/lot?lot_id=3472&report_type=complete"

# Réponse:
{
  "status": "submitted",
  "task_id": "xyz-789-abc-012",
  "lot_id": 3472,
  "report_type": "complete",
  "message": "PDF generation started"
}

# Récupérer résultat
curl "http://localhost:8000/api/tasks/status/xyz-789-abc-012"

# Réponse:
{
  "task_id": "xyz-789-abc-012",
  "status": "SUCCESS",
  "result": {
    "status": "success",
    "lot_id": 3472,
    "report_type": "complete",
    "pdf_url": "/exports/reports/lot_3472_complete_20260108.pdf",
    "file_size": 523847,
    "generated_at": "2026-01-08T13:15:42"
  }
}

# Télécharger PDF
curl "http://localhost:8000/exports/reports/lot_3472_complete_20260108.pdf" -o rapport.pdf
```

#### Exemple 3: Notification SMS
```bash
# Envoyer SMS d'alerte
curl -X POST "http://localhost:8000/api/tasks/notifications/sms" \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+33612345678",
    "message": "⚠️ Alerte: Taux mortalité élevé sur lot LL2601001 (3.2%)",
    "priority": "high"
  }'

# Réponse:
{
  "status": "submitted",
  "task_id": "sms-456-def-789",
  "phone": "+33612345678",
  "message": "SMS sending started"
}
```

### Monitoring avec Flower

```bash
# Accéder à Flower
http://localhost:5555

# Auth: admin / gaveurs_flower_2024
```

**Features Flower**:
- 📊 Dashboard temps réel (tâches actives, succès/échecs)
- 📈 Graphiques performance workers
- 🔍 Historique tâches (succès, échecs, retry)
- ⏱️ Durée moyenne par type de tâche
- 📋 Détails complets d'une tâche (args, kwargs, traceback)
- 🔄 Retry/Revoke tâches

---

## 📊 Statistiques API

### GET /api/tasks/stats

Récupère statistiques globales Celery.

```bash
curl "http://localhost:8000/api/tasks/stats"

# Réponse:
{
  "workers": ["celery@gaveurs_celery_worker"],
  "nb_workers": 1,
  "tasks_active": 3,
  "tasks_scheduled": 5,
  "tasks_reserved": 2,
  "total_pending": 10,
  "worker_stats": {
    "celery@gaveurs_celery_worker": {
      "total": {
        "ml_heavy": 150,
        "ml_light": 450,
        "exports": 280,
        "notifications": 520
      },
      "pool": {
        "max-concurrency": 4,
        "processes": [12345, 12346, 12347, 12348]
      }
    }
  }
}
```

### GET /api/tasks/list/active

Liste tâches en cours (PENDING, STARTED).

```bash
curl "http://localhost:8000/api/tasks/list/active?limit=10"

# Réponse:
{
  "total": 3,
  "tasks": [
    {
      "task_id": "abc-123",
      "task_name": "train_pysr_async",
      "status": "STARTED",
      "worker": "celery@gaveurs_celery_worker",
      "started_at": "2026-01-08T12:30:00"
    },
    {
      "task_id": "def-456",
      "task_name": "generate_lot_pdf_report",
      "status": "STARTED",
      "worker": "celery@gaveurs_celery_worker",
      "started_at": "2026-01-08T12:32:15"
    },
    {
      "task_id": "ghi-789",
      "task_name": "send_email_notification",
      "status": "PENDING",
      "eta": "2026-01-08T12:35:00"
    }
  ]
}
```

### DELETE /api/tasks/cancel/{task_id}

Annule une tâche en cours.

```bash
curl -X DELETE "http://localhost:8000/api/tasks/cancel/abc-123"

# Réponse:
{
  "status": "cancelled",
  "task_id": "abc-123",
  "message": "Task cancellation requested"
}
```

---

## ⚙️ Configuration

### Beat Schedule (Tâches Périodiques)

Fichier: `backend-api/app/tasks/celery_app.py`

```python
celery_app.conf.beat_schedule = {
    # Toutes les heures
    'refresh-continuous-aggregates-hourly': {
        'task': 'app.tasks.scheduled_tasks.refresh_continuous_aggregates',
        'schedule': crontab(minute=0),  # Toutes les heures à :00
    },

    # Quotidien 3h
    'backup-database-daily': {
        'task': 'app.tasks.scheduled_tasks.backup_database_task',
        'schedule': crontab(hour=3, minute=0),
    },

    # Quotidien 4h
    'cleanup-old-tasks-daily': {
        'task': 'app.tasks.scheduled_tasks.cleanup_old_celery_tasks',
        'schedule': crontab(hour=4, minute=0),
    },

    # Quotidien 18h
    'daily-summary-reports': {
        'task': 'app.tasks.notification_tasks.send_daily_summary_reports',
        'schedule': crontab(hour=18, minute=0),
    },

    # Hebdomadaire lundi 6h
    'weekly-reports-generation': {
        'task': 'app.tasks.export_tasks.weekly_reports_generation',
        'schedule': crontab(hour=6, minute=0, day_of_week=1),  # Lundi
    },

    # Hebdomadaire lundi 7h
    'weekly-kpis-calculation': {
        'task': 'app.tasks.scheduled_tasks.calculate_weekly_kpis',
        'schedule': crontab(hour=7, minute=0, day_of_week=1),
    },

    # Mensuel 1er du mois à 2h
    'monthly-ml-retraining': {
        'task': 'app.tasks.scheduled_tasks.monthly_ml_models_retraining',
        'schedule': crontab(hour=2, minute=0, day_of_month=1),
    },

    # Mensuel 1er du mois à 5h
    'cleanup-old-sensor-data': {
        'task': 'app.tasks.scheduled_tasks.cleanup_old_sensor_data',
        'schedule': crontab(hour=5, minute=0, day_of_month=1),
    },

    # Toutes les 6h
    'health-check-periodic': {
        'task': 'app.tasks.scheduled_tasks.health_check_periodic',
        'schedule': crontab(minute=0, hour='*/6'),
    },

    # Toutes les 6h (anomalies)
    'anomalies-detection-periodic': {
        'task': 'app.tasks.ml_tasks.detect_anomalies_periodic',
        'schedule': crontab(minute=0, hour='*/6'),
    }
}
```

### Task Routing (Queues)

```python
celery_app.conf.task_routes = {
    # ML Tasks Lourds → Queue ml_heavy
    'app.tasks.ml_tasks.train_pysr_async': {'queue': 'ml_heavy'},
    'app.tasks.ml_tasks.optimize_feeding_curve_async': {'queue': 'ml_heavy'},
    'app.tasks.ml_tasks.optimize_abattage_planning_async': {'queue': 'ml_heavy'},
    'app.tasks.ml_tasks.retrain_all_ml_models_async': {'queue': 'ml_heavy'},

    # ML Tasks Légers → Queue ml_light
    'app.tasks.ml_tasks.train_prophet_async': {'queue': 'ml_light'},
    'app.tasks.ml_tasks.cluster_gaveurs_async': {'queue': 'ml_light'},
    'app.tasks.ml_tasks.detect_anomalies_async': {'queue': 'ml_light'},

    # Exports → Queue exports
    'app.tasks.export_tasks.*': {'queue': 'exports'},

    # Notifications → Queue notifications
    'app.tasks.notification_tasks.*': {'queue': 'notifications'},

    # Scheduled → Queue default
    'app.tasks.scheduled_tasks.*': {'queue': 'default'}
}
```

---

## 🔧 Troubleshooting

### Worker ne démarre pas

```bash
# Vérifier logs
docker logs gaveurs_celery_worker

# Erreurs communes:
# 1. Redis non disponible → Attendre que Redis démarre
# 2. Import error → Vérifier requirements.txt installés
# 3. Database connection → Vérifier DATABASE_URL
```

### Tâche bloquée en PENDING

```bash
# Vérifier worker en cours d'exécution
docker ps | grep celery_worker

# Vérifier queues Redis
docker exec -it gaveurs_redis redis-cli
> LLEN celery  # Nombre messages en queue
> LPOP celery  # Récupérer premier message

# Redémarrer worker
docker restart gaveurs_celery_worker
```

### Tâche échouée (FAILURE)

```bash
# Récupérer erreur via API
curl "http://localhost:8000/api/tasks/status/task-id-failed"

# Réponse:
{
  "status": "FAILURE",
  "error": "ConnectionError: Database connection lost"
}

# Vérifier logs worker
docker logs gaveurs_celery_worker --tail 50

# Retry manuel
curl -X POST "http://localhost:8000/api/tasks/ml/pysr/train?lot_id=3472"
```

### Beat ne déclenche pas tâches planifiées

```bash
# Vérifier Beat en cours
docker ps | grep celery_beat

# Vérifier logs Beat
docker logs gaveurs_celery_beat --tail 50

# Doit afficher:
# [2026-01-08 12:00:00,123: INFO/MainProcess] Scheduler: Sending due task refresh-continuous-aggregates-hourly

# Vérifier schedule configuré
docker exec -it gaveurs_celery_beat celery -A app.tasks.celery_app inspect scheduled

# Redémarrer Beat
docker restart gaveurs_celery_beat
```

---

## 📚 Ressources

- [Celery Documentation](https://docs.celeryproject.org/)
- [Celery Best Practices](https://docs.celeryproject.org/en/stable/userguide/tasks.html#tips-and-best-practices)
- [Flower Documentation](https://flower.readthedocs.io/)
- [Redis Documentation](https://redis.io/documentation)

---

**Auteur**: Claude Code
**Date**: 08 Janvier 2026
**Statut**: ✅ Implémentation complète
