"""
Celery Application Configuration
"""

from celery import Celery
from celery.schedules import crontab
import os

# Configuration Redis / Celery
# Priority:
# 1) CELERY_BROKER_URL / CELERY_RESULT_BACKEND (docker-compose)
# 2) REDIS_HOST/PORT + REDIS_*_DB (legacy defaults)
REDIS_HOST = os.getenv('REDIS_HOST', 'gaveurs_redis')
REDIS_PORT = os.getenv('REDIS_PORT', '6379')
REDIS_BROKER_DB = os.getenv('REDIS_BROKER_DB', '0')
REDIS_RESULT_DB = os.getenv('REDIS_RESULT_DB', '1')

BROKER_URL = os.getenv(
    'CELERY_BROKER_URL',
    f'redis://{REDIS_HOST}:{REDIS_PORT}/{REDIS_BROKER_DB}'
)
RESULT_BACKEND = os.getenv(
    'CELERY_RESULT_BACKEND',
    f'redis://{REDIS_HOST}:{REDIS_PORT}/{REDIS_RESULT_DB}'
)

# Créer instance Celery
celery_app = Celery(
    'gaveurs',
    broker=BROKER_URL,
    backend=RESULT_BACKEND,
    include=[
        'app.tasks.ml_tasks',
        'app.tasks.export_tasks',
        'app.tasks.notification_tasks',
        'app.tasks.scheduled_tasks',
    ]
)

# Configuration
celery_app.conf.update(
    # Serialization
    task_serializer='json',
    accept_content=['json'],
    result_serializer='json',

    # Timezone
    timezone='Europe/Paris',
    enable_utc=True,

    # Task execution
    task_track_started=True,
    task_time_limit=3600,  # 1 heure max par tâche
    task_soft_time_limit=3300,  # Warning à 55 minutes

    # Worker config
    worker_prefetch_multiplier=1,  # Une tâche à la fois (important pour ML lourd)
    worker_max_tasks_per_child=50,  # Restart worker après 50 tâches (évite memory leaks)

    # Results
    result_expires=86400,  # Résultats gardés 24h
    result_extended=True,  # Informations étendues sur résultats

    # Retry
    task_acks_late=True,  # Acknowledge après exécution (pas avant)
    task_reject_on_worker_lost=True,  # Re-queue si worker crash

    # Monitoring
    worker_send_task_events=True,
    task_send_sent_event=True,

    # Tâches périodiques (Celery Beat)
    beat_schedule={
        # Refresh continuous aggregates toutes les heures
        'refresh-continuous-aggregates-hourly': {
            'task': 'app.tasks.scheduled_tasks.refresh_continuous_aggregates',
            'schedule': crontab(minute=0),  # xx:00
        },

        # Backup base de données tous les jours à 3h du matin
        'backup-database-daily': {
            'task': 'app.tasks.scheduled_tasks.backup_database_task',
            'schedule': crontab(hour=3, minute=0),
        },

        # Calcul KPIs hebdomadaires (Lundi 8h)
        'calculate-weekly-kpis': {
            'task': 'app.tasks.scheduled_tasks.calculate_weekly_kpis',
            'schedule': crontab(day_of_week=1, hour=8, minute=0),
        },

        # Nettoyage anciennes tâches Celery (tous les jours à 4h)
        'cleanup-old-tasks': {
            'task': 'app.tasks.scheduled_tasks.cleanup_old_celery_results',
            'schedule': crontab(hour=4, minute=0),
        },

        # Détection anomalies toutes les 6h
        'detect-anomalies-periodic': {
            'task': 'app.tasks.ml_tasks.detect_anomalies_periodic',
            'schedule': crontab(minute=0, hour='*/6'),  # 0h, 6h, 12h, 18h
        },
    },
)

# Queues multiples (priorités)
celery_app.conf.task_routes = {
    # Tâches ML lourdes → queue dédiée
    'app.tasks.ml_tasks.train_pysr_async': {'queue': 'ml_heavy'},
    'app.tasks.ml_tasks.train_pysr_multi_async': {'queue': 'ml_heavy'},
    'app.tasks.ml_tasks.optimize_feeding_curve_async': {'queue': 'ml_heavy'},
    'app.tasks.ml_tasks.train_prophet_async': {'queue': 'ml_heavy'},

    # Tâches ML légères → queue standard
    'app.tasks.ml_tasks.detect_anomalies_*': {'queue': 'ml_light'},
    'app.tasks.ml_tasks.cluster_gaveurs_async': {'queue': 'ml_light'},
    'app.tasks.ml_tasks.cluster_lots_pred_async': {'queue': 'ml_light'},

    # Exports → queue dédiée
    'app.tasks.export_tasks.*': {'queue': 'exports'},

    # Notifications → priorité haute
    'app.tasks.notification_tasks.*': {'queue': 'notifications', 'priority': 9},

    # Tâches périodiques → queue normale
    'app.tasks.scheduled_tasks.*': {'queue': 'default'},
}

if __name__ == '__main__':
    celery_app.start()
