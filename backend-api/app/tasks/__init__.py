"""
Celery Tasks Package - Système Gaveurs V3.0

Gestion des tâches asynchrones:
- ML/Analytics (entraînements longs)
- Exports (PDF, CSV)
- Notifications (SMS, Email)
- Tâches périodiques (backup, KPIs, refresh aggregates)
"""

from app.tasks.celery_app import celery_app

__all__ = ['celery_app']
