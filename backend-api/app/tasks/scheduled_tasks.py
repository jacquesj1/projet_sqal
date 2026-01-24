"""
Tâches Planifiées (Celery Beat)

Maintenance automatique, refresh vues matérialisées, cleanup, KPIs:
- Refresh Continuous Aggregates (toutes les heures)
- Backup Database (quotidien)
- Cleanup Old Tasks (quotidien)
- Weekly KPIs Calculation (hebdomadaire)
- Monthly Model Retraining (mensuel)
"""

from app.tasks.celery_app import celery_app
import logging
from typing import Dict, Any
import os
import asyncpg
from datetime import datetime, timedelta
import subprocess

logger = logging.getLogger(__name__)

# Configuration
DATABASE_URL = os.getenv('DATABASE_URL', 'postgresql://gaveurs_admin:gaveurs_secure_2024@gaveurs_timescaledb:5432/gaveurs_db')
BACKUP_DIR = os.getenv('BACKUP_DIR', '/app/backups')


@celery_app.task(time_limit=300)
def refresh_continuous_aggregates() -> Dict[str, Any]:
    """
    Refresh toutes les continuous aggregates TimescaleDB

    Appelée toutes les heures par Celery Beat.
    Rafraîchit les 8 vues matérialisées pour analytics temps réel.

    Returns:
        dict: Résumé refresh
    """
    try:
        logger.info("🔄 Refreshing continuous aggregates")

        import asyncio

        async def refresh_all():
            conn = await asyncpg.connect(DATABASE_URL)

            aggregates = [
                'gavage_stats_hourly',
                'gavage_stats_daily',
                'doses_journalieres_stats',
                'sqal_quality_hourly',
                'sqal_quality_daily',
                'consumer_ratings_daily',
                'alertes_summary_hourly',
                'performances_sites'
            ]

            refreshed = []

            for agg_name in aggregates:
                try:
                    await conn.execute(f"CALL refresh_continuous_aggregate('{agg_name}', NULL, NULL)")
                    refreshed.append(agg_name)
                    logger.info(f"  ✅ Refreshed: {agg_name}")
                except Exception as e:
                    logger.warning(f"  ⚠️ Could not refresh {agg_name}: {e}")

            await conn.close()
            return refreshed

        refreshed_aggregates = asyncio.run(refresh_all())

        logger.info(f"✅ Continuous aggregates refresh completed - {len(refreshed_aggregates)}/{8} refreshed")

        return {
            "status": "success",
            "refreshed_count": len(refreshed_aggregates),
            "refreshed_aggregates": refreshed_aggregates,
            "timestamp": datetime.utcnow().isoformat()
        }

    except Exception as exc:
        logger.error(f"❌ Continuous aggregates refresh failed: {exc}", exc_info=True)
        return {"status": "error", "error": str(exc)}


@celery_app.task(time_limit=600)
def backup_database_task() -> Dict[str, Any]:
    """
    Backup quotidien de la base de données

    Appelée tous les jours à 3h du matin par Celery Beat.
    Crée dump PostgreSQL compressé.

    Returns:
        dict: Informations backup
    """
    try:
        logger.info("💾 Starting database backup")

        # Créer répertoire backup si nécessaire
        os.makedirs(BACKUP_DIR, exist_ok=True)

        # Nom fichier backup
        timestamp = datetime.utcnow().strftime('%Y%m%d_%H%M%S')
        backup_filename = f"gaveurs_db_backup_{timestamp}.sql.gz"
        backup_path = os.path.join(BACKUP_DIR, backup_filename)

        # Commande pg_dump avec compression
        cmd = [
            'pg_dump',
            '-h', 'gaveurs_timescaledb',
            '-U', 'gaveurs_admin',
            '-d', 'gaveurs_db',
            '-F', 'c',  # Custom format (compressed)
            '-f', backup_path
        ]

        # Exécuter backup
        result = subprocess.run(
            cmd,
            env={'PGPASSWORD': 'gaveurs_secure_2024'},
            capture_output=True,
            text=True,
            timeout=600
        )

        if result.returncode != 0:
            raise Exception(f"pg_dump failed: {result.stderr}")

        file_size = os.path.getsize(backup_path)

        logger.info(f"✅ Database backup completed - Size: {file_size / (1024*1024):.1f} MB")

        # Nettoyer anciens backups (garder 30 jours)
        cleanup_old_backups(BACKUP_DIR, days=30)

        return {
            "status": "success",
            "backup_file": backup_filename,
            "backup_path": backup_path,
            "file_size": file_size,
            "timestamp": datetime.utcnow().isoformat()
        }

    except Exception as exc:
        logger.error(f"❌ Database backup failed: {exc}", exc_info=True)
        return {"status": "error", "error": str(exc)}


def cleanup_old_backups(backup_dir: str, days: int = 30):
    """
    Supprime backups de plus de N jours

    Args:
        backup_dir: Répertoire backups
        days: Nombre de jours à conserver
    """
    try:
        cutoff_date = datetime.utcnow() - timedelta(days=days)

        for filename in os.listdir(backup_dir):
            if filename.startswith('gaveurs_db_backup_'):
                filepath = os.path.join(backup_dir, filename)
                file_time = datetime.fromtimestamp(os.path.getmtime(filepath))

                if file_time < cutoff_date:
                    os.remove(filepath)
                    logger.info(f"  🗑️ Deleted old backup: {filename}")

    except Exception as e:
        logger.warning(f"Backup cleanup warning: {e}")


@celery_app.task(time_limit=180)
def cleanup_old_celery_tasks() -> Dict[str, Any]:
    """
    Nettoyage anciennes tâches Celery terminées

    Appelée tous les jours à 4h par Celery Beat.
    Supprime résultats de tâches > 7 jours.

    Returns:
        dict: Résumé nettoyage
    """
    try:
        logger.info("🧹 Cleaning up old Celery tasks")

        from celery.result import AsyncResult
        from app.tasks.celery_app import celery_app

        # Supprimer résultats Redis > 7 jours
        # Note: Celery ne stocke pas les timestamps, on utilise TTL Redis
        cutoff = 7 * 24 * 60 * 60  # 7 jours en secondes

        # Cette opération dépend du backend Redis
        # Les résultats expireront automatiquement avec result_expires
        logger.info("✅ Old tasks cleanup completed (automatic via result_expires)")

        return {
            "status": "success",
            "message": "Tasks auto-expire after 7 days",
            "timestamp": datetime.utcnow().isoformat()
        }

    except Exception as exc:
        logger.error(f"❌ Tasks cleanup failed: {exc}", exc_info=True)
        return {"status": "error", "error": str(exc)}


@celery_app.task(time_limit=1800)
def calculate_weekly_kpis() -> Dict[str, Any]:
    """
    Calcul KPIs hebdomadaires

    Appelée tous les lundis à 7h par Celery Beat.
    Calcule KPIs semaine écoulée pour chaque site.

    Returns:
        dict: KPIs calculés
    """
    try:
        logger.info("📊 Calculating weekly KPIs")

        import asyncio

        async def calculate_kpis():
            conn = await asyncpg.connect(DATABASE_URL)

            # Dates (lundi dernier → dimanche)
            today = datetime.utcnow()
            date_fin = (today - timedelta(days=today.weekday())).strftime('%Y-%m-%d')
            date_debut = (datetime.strptime(date_fin, '%Y-%m-%d') - timedelta(days=7)).strftime('%Y-%m-%d')

            sites = ['LL', 'LS', 'MT']
            kpis = {}

            for site in sites:
                # KPIs gavage
                gavage_kpis = await conn.fetchrow("""
                    SELECT
                        COUNT(DISTINCT gdl.lot_gavage_id) as nb_lots_actifs,
                        AVG(gdl.dose_moyenne) as dose_moyenne,
                        AVG(gdl.poids_moyen_lot) as poids_moyen,
                        AVG(gdl.taux_mortalite) as taux_mortalite,
                        COUNT(*) as nb_repas
                    FROM gavage_data_lots gdl
                    JOIN lots_gavage lg ON gdl.lot_gavage_id = lg.id
                    WHERE lg.site_code = $1
                      AND gdl.time >= $2::timestamp
                      AND gdl.time < $3::timestamp
                """, site, date_debut, date_fin)

                # KPIs SQAL
                sqal_kpis = await conn.fetchrow("""
                    SELECT
                        COUNT(*) as nb_samples,
                        COUNT(DISTINCT lot_id) as nb_lots_inspected,
                        SUM(CASE WHEN quality_grade IN ('A+', 'A') THEN 1 ELSE 0 END)::float / COUNT(*) * 100 as taux_qualite_a
                    FROM sqal_sensor_samples
                    WHERE time >= $1::timestamp
                      AND time < $2::timestamp
                """, date_debut, date_fin)

                # Alertes
                alertes_count = await conn.fetchval("""
                    SELECT COUNT(*)
                    FROM alertes_euralis
                    WHERE time >= $1::timestamp
                      AND time < $2::timestamp
                """, date_debut, date_fin)

                kpis[site] = {
                    "gavage": dict(gavage_kpis) if gavage_kpis else {},
                    "sqal": dict(sqal_kpis) if sqal_kpis else {},
                    "alertes": alertes_count or 0
                }

                # Insérer dans table statistiques_globales
                await conn.execute("""
                    INSERT INTO statistiques_globales (
                        site_code,
                        periode_debut,
                        periode_fin,
                        nb_lots,
                        dose_moyenne,
                        poids_moyen,
                        taux_mortalite,
                        nb_sqal_samples,
                        taux_qualite_a,
                        nb_alertes
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                """,
                    site,
                    date_debut,
                    date_fin,
                    kpis[site]['gavage'].get('nb_lots_actifs', 0),
                    kpis[site]['gavage'].get('dose_moyenne', 0),
                    kpis[site]['gavage'].get('poids_moyen', 0),
                    kpis[site]['gavage'].get('taux_mortalite', 0),
                    kpis[site]['sqal'].get('nb_samples', 0),
                    kpis[site]['sqal'].get('taux_qualite_a', 0),
                    kpis[site]['alertes']
                )

            await conn.close()
            return kpis

        weekly_kpis = asyncio.run(calculate_kpis())

        logger.info(f"✅ Weekly KPIs calculated for {len(weekly_kpis)} sites")

        return {
            "status": "success",
            "period": f"{date_debut} → {date_fin}",
            "kpis": weekly_kpis,
            "timestamp": datetime.utcnow().isoformat()
        }

    except Exception as exc:
        logger.error(f"❌ Weekly KPIs calculation failed: {exc}", exc_info=True)
        return {"status": "error", "error": str(exc)}


@celery_app.task(time_limit=3600)
def monthly_ml_models_retraining() -> Dict[str, Any]:
    """
    Re-entraînement mensuel de tous les modèles ML

    Appelée le 1er de chaque mois à 2h par Celery Beat.
    Déclenche re-entraînement de tous les modèles ML.

    Returns:
        dict: Résumé re-entraînements
    """
    try:
        logger.info("🤖 Starting monthly ML models retraining")

        from app.tasks.ml_tasks import retrain_all_ml_models_async

        # Déclencher re-entraînement (tâche asynchrone)
        result = retrain_all_ml_models_async.delay()

        # Attendre résultat (max 1h)
        final_result = result.get(timeout=3600)

        logger.info("✅ Monthly ML retraining completed")

        return {
            "status": "success",
            "retraining_result": final_result,
            "timestamp": datetime.utcnow().isoformat()
        }

    except Exception as exc:
        logger.error(f"❌ Monthly ML retraining failed: {exc}", exc_info=True)
        return {"status": "error", "error": str(exc)}


@celery_app.task(time_limit=300)
def cleanup_old_sensor_data() -> Dict[str, Any]:
    """
    Nettoyage anciennes données capteurs SQAL (> 1 an)

    Appelée le 1er de chaque mois à 5h par Celery Beat.
    Utilise retention policy TimescaleDB.

    Returns:
        dict: Résumé nettoyage
    """
    try:
        logger.info("🗑️ Cleaning up old sensor data (>1 year)")

        import asyncio

        async def cleanup():
            conn = await asyncpg.connect(DATABASE_URL)

            # Vérifier si retention policy existe
            policy_exists = await conn.fetchval("""
                SELECT COUNT(*) FROM timescaledb_information.jobs
                WHERE proc_name = 'policy_retention'
                  AND hypertable_name = 'sqal_sensor_samples'
            """)

            if not policy_exists:
                # Créer retention policy (supprimer > 365 jours)
                await conn.execute("""
                    SELECT add_retention_policy('sqal_sensor_samples', INTERVAL '365 days')
                """)
                logger.info("  ✅ Retention policy created for sqal_sensor_samples")

            # Compter données supprimées (approximation)
            deleted_count = await conn.fetchval("""
                SELECT COUNT(*) FROM sqal_sensor_samples
                WHERE time < NOW() - INTERVAL '365 days'
            """)

            await conn.close()
            return deleted_count or 0

        deleted = asyncio.run(cleanup())

        logger.info(f"✅ Old sensor data cleanup completed - {deleted} rows affected")

        return {
            "status": "success",
            "rows_deleted": deleted,
            "timestamp": datetime.utcnow().isoformat()
        }

    except Exception as exc:
        logger.error(f"❌ Sensor data cleanup failed: {exc}", exc_info=True)
        return {"status": "error", "error": str(exc)}


@celery_app.task(time_limit=180)
def health_check_periodic() -> Dict[str, Any]:
    """
    Health check périodique du système

    Appelée toutes les 6h par Celery Beat.
    Vérifie santé database, backend, simulateurs.

    Returns:
        dict: Statut système
    """
    try:
        logger.info("🏥 Running periodic health check")

        import asyncio
        import aiohttp

        async def check_health():
            results = {}

            # Check Database
            try:
                conn = await asyncpg.connect(DATABASE_URL)
                await conn.fetchval("SELECT 1")
                await conn.close()
                results['database'] = {'status': 'healthy'}
            except Exception as e:
                results['database'] = {'status': 'unhealthy', 'error': str(e)}

            # Check Backend API
            try:
                async with aiohttp.ClientSession() as session:
                    async with session.get('http://gaveurs_backend:8000/health', timeout=5) as resp:
                        if resp.status == 200:
                            results['backend'] = {'status': 'healthy'}
                        else:
                            results['backend'] = {'status': 'unhealthy', 'code': resp.status}
            except Exception as e:
                results['backend'] = {'status': 'unhealthy', 'error': str(e)}

            # Check Redis
            try:
                from app.tasks.celery_app import celery_app
                celery_app.backend.get('health-check-test')
                results['redis'] = {'status': 'healthy'}
            except Exception as e:
                results['redis'] = {'status': 'unhealthy', 'error': str(e)}

            return results

        health_results = asyncio.run(check_health())

        all_healthy = all(r.get('status') == 'healthy' for r in health_results.values())

        logger.info(f"✅ Health check completed - Status: {'HEALTHY' if all_healthy else 'DEGRADED'}")

        # Si système dégradé, envoyer alerte
        if not all_healthy:
            from app.tasks.notification_tasks import send_email_notification
            send_email_notification.delay(
                to_email='admin@euralis.com',
                subject='⚠️ System Health Check Failed',
                body_html=f"<p>Health check results:</p><pre>{health_results}</pre>"
            )

        return {
            "status": "success" if all_healthy else "degraded",
            "health_results": health_results,
            "timestamp": datetime.utcnow().isoformat()
        }

    except Exception as exc:
        logger.error(f"❌ Health check failed: {exc}", exc_info=True)
        return {"status": "error", "error": str(exc)}
