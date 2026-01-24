"""
Tâches d'Export Asynchrones

Génération de rapports PDF, exports CSV, certificats blockchain qui peuvent prendre du temps:
- PDF Reports (Lots, Sites, Qualité) - 10-60 secondes
- CSV Exports (Données gavage, SQAL, Consumer) - 5-30 secondes
- Blockchain Certificates - 2-10 secondes
"""

from app.tasks.celery_app import celery_app
import logging
from typing import Dict, Any, List
import os
import asyncpg
from datetime import datetime, timedelta
import csv
import io

logger = logging.getLogger(__name__)

# Configuration Database
DATABASE_URL = os.getenv('DATABASE_URL', 'postgresql://gaveurs_admin:gaveurs_secure_2024@gaveurs_timescaledb:5432/gaveurs_db')


@celery_app.task(bind=True, max_retries=2, time_limit=120)
def generate_lot_pdf_report(self, lot_id: int, report_type: str = 'complete') -> Dict[str, Any]:
    """
    Génération rapport PDF pour un lot

    Crée PDF avec: performances, courbes gavage, analyses qualité, blockchain.

    Args:
        lot_id: ID du lot
        report_type: Type rapport ('complete', 'summary', 'quality')

    Returns:
        dict: {
            "status": "success",
            "lot_id": int,
            "pdf_url": str,
            "file_size": int
        }
    """
    try:
        logger.info(f"📄 Generating PDF report for lot {lot_id} - Type: {report_type}")

        from app.services.pdf_generator import generate_lot_report_pdf

        # Générer PDF
        pdf_path = generate_lot_report_pdf(lot_id, report_type)
        file_size = os.path.getsize(pdf_path)

        logger.info(f"✅ PDF report generated - Size: {file_size / 1024:.1f} KB")

        return {
            "status": "success",
            "lot_id": lot_id,
            "report_type": report_type,
            "pdf_url": f"/exports/reports/{os.path.basename(pdf_path)}",
            "file_size": file_size,
            "generated_at": datetime.utcnow().isoformat()
        }

    except Exception as exc:
        logger.error(f"❌ PDF generation failed for lot {lot_id}: {exc}", exc_info=True)
        raise self.retry(exc=exc, countdown=30)


@celery_app.task(bind=True, max_retries=2, time_limit=120)
def generate_site_pdf_report(self, site_code: str, date_debut: str, date_fin: str) -> Dict[str, Any]:
    """
    Génération rapport PDF pour un site Euralis

    Crée PDF avec: KPIs site, performances gaveurs, analyses ML, alertes.

    Args:
        site_code: Code site ('LL', 'LS', 'MT')
        date_debut: Date début (YYYY-MM-DD)
        date_fin: Date fin (YYYY-MM-DD)

    Returns:
        dict: Informations PDF généré
    """
    try:
        logger.info(f"📄 Generating site PDF report for {site_code}: {date_debut} → {date_fin}")

        from app.services.pdf_generator import generate_site_report_pdf

        pdf_path = generate_site_report_pdf(site_code, date_debut, date_fin)
        file_size = os.path.getsize(pdf_path)

        logger.info(f"✅ Site PDF report generated - Size: {file_size / 1024:.1f} KB")

        return {
            "status": "success",
            "site_code": site_code,
            "date_debut": date_debut,
            "date_fin": date_fin,
            "pdf_url": f"/exports/reports/{os.path.basename(pdf_path)}",
            "file_size": file_size
        }

    except Exception as exc:
        logger.error(f"❌ Site PDF generation failed: {exc}", exc_info=True)
        raise self.retry(exc=exc, countdown=30)


@celery_app.task(bind=True, max_retries=2, time_limit=60)
def export_gavage_data_csv(self, lot_id: int = None, date_debut: str = None, date_fin: str = None) -> Dict[str, Any]:
    """
    Export données gavage en CSV

    Exporte gavage_data_lots avec filtres optionnels.

    Args:
        lot_id: ID lot optionnel (None = tous)
        date_debut: Date début optionnelle
        date_fin: Date fin optionnelle

    Returns:
        dict: Informations CSV généré
    """
    try:
        logger.info(f"📊 Exporting gavage data to CSV - Lot: {lot_id}, Period: {date_debut} → {date_fin}")

        # Import lazy
        import asyncio
        from app.services.csv_exporter import export_gavage_csv

        # Utiliser asyncio pour la requête DB
        csv_path = asyncio.run(export_gavage_csv(lot_id, date_debut, date_fin))
        file_size = os.path.getsize(csv_path)

        logger.info(f"✅ CSV export completed - Size: {file_size / 1024:.1f} KB")

        return {
            "status": "success",
            "lot_id": lot_id,
            "csv_url": f"/exports/csv/{os.path.basename(csv_path)}",
            "file_size": file_size,
            "rows_exported": file_size // 150  # Approximation
        }

    except Exception as exc:
        logger.error(f"❌ CSV export failed: {exc}", exc_info=True)
        raise self.retry(exc=exc, countdown=20)


@celery_app.task(bind=True, max_retries=2, time_limit=60)
def export_sqal_data_csv(self, lot_id: int = None, date_debut: str = None, date_fin: str = None) -> Dict[str, Any]:
    """
    Export données SQAL en CSV

    Exporte sqal_sensor_samples avec matrices ToF et canaux spectraux.

    Args:
        lot_id: ID lot optionnel
        date_debut: Date début optionnelle
        date_fin: Date fin optionnelle

    Returns:
        dict: Informations CSV généré
    """
    try:
        logger.info(f"📊 Exporting SQAL data to CSV - Lot: {lot_id}")

        import asyncio
        from app.services.csv_exporter import export_sqal_csv

        csv_path = asyncio.run(export_sqal_csv(lot_id, date_debut, date_fin))
        file_size = os.path.getsize(csv_path)

        logger.info(f"✅ SQAL CSV export completed - Size: {file_size / 1024:.1f} KB")

        return {
            "status": "success",
            "lot_id": lot_id,
            "csv_url": f"/exports/csv/{os.path.basename(csv_path)}",
            "file_size": file_size
        }

    except Exception as exc:
        logger.error(f"❌ SQAL CSV export failed: {exc}", exc_info=True)
        raise self.retry(exc=exc, countdown=20)


@celery_app.task(bind=True, max_retries=2, time_limit=60)
def export_consumer_feedbacks_csv(self, date_debut: str = None, date_fin: str = None) -> Dict[str, Any]:
    """
    Export feedbacks consommateurs en CSV

    Exporte consumer_feedbacks avec corrélations production.

    Args:
        date_debut: Date début optionnelle
        date_fin: Date fin optionnelle

    Returns:
        dict: Informations CSV généré
    """
    try:
        logger.info(f"📊 Exporting consumer feedbacks to CSV")

        import asyncio
        from app.services.csv_exporter import export_feedbacks_csv

        csv_path = asyncio.run(export_feedbacks_csv(date_debut, date_fin))
        file_size = os.path.getsize(csv_path)

        logger.info(f"✅ Consumer feedbacks CSV export completed - Size: {file_size / 1024:.1f} KB")

        return {
            "status": "success",
            "csv_url": f"/exports/csv/{os.path.basename(csv_path)}",
            "file_size": file_size
        }

    except Exception as exc:
        logger.error(f"❌ Consumer feedbacks CSV export failed: {exc}", exc_info=True)
        raise self.retry(exc=exc, countdown=20)


@celery_app.task(bind=True, max_retries=2, time_limit=30)
def generate_blockchain_certificate(self, lot_id: int, certificate_type: str = 'tracabilite') -> Dict[str, Any]:
    """
    Génération certificat blockchain pour un lot

    Crée certificat PDF avec QR code et hash blockchain.

    Args:
        lot_id: ID du lot
        certificate_type: Type certificat ('tracabilite', 'qualite', 'complete')

    Returns:
        dict: {
            "status": "success",
            "lot_id": int,
            "certificate_url": str,
            "blockchain_hash": str,
            "qr_code_url": str
        }
    """
    try:
        logger.info(f"🔗 Generating blockchain certificate for lot {lot_id} - Type: {certificate_type}")

        from app.services.blockchain_certificate import generate_certificate

        # Générer certificat avec hash blockchain
        result = generate_certificate(lot_id, certificate_type)

        logger.info(f"✅ Blockchain certificate generated - Hash: {result['blockchain_hash'][:16]}...")

        return {
            "status": "success",
            "lot_id": lot_id,
            "certificate_type": certificate_type,
            "certificate_url": result["certificate_url"],
            "blockchain_hash": result["blockchain_hash"],
            "qr_code_url": result["qr_code_url"],
            "generated_at": datetime.utcnow().isoformat()
        }

    except Exception as exc:
        logger.error(f"❌ Blockchain certificate generation failed: {exc}", exc_info=True)
        raise self.retry(exc=exc, countdown=15)


@celery_app.task(time_limit=180)
def batch_export_lots_csv(lot_ids: List[int]) -> Dict[str, Any]:
    """
    Export en batch de plusieurs lots en CSV

    Crée un fichier CSV consolidé pour plusieurs lots.

    Args:
        lot_ids: Liste des IDs de lots à exporter

    Returns:
        dict: Informations export batch
    """
    try:
        logger.info(f"📦 Batch export for {len(lot_ids)} lots")

        import asyncio
        from app.services.csv_exporter import export_batch_lots_csv

        csv_path = asyncio.run(export_batch_lots_csv(lot_ids))
        file_size = os.path.getsize(csv_path)

        logger.info(f"✅ Batch export completed - {len(lot_ids)} lots, Size: {file_size / 1024:.1f} KB")

        return {
            "status": "success",
            "nb_lots": len(lot_ids),
            "lot_ids": lot_ids,
            "csv_url": f"/exports/csv/{os.path.basename(csv_path)}",
            "file_size": file_size
        }

    except Exception as exc:
        logger.error(f"❌ Batch export failed: {exc}", exc_info=True)
        return {"status": "error", "error": str(exc)}


@celery_app.task(bind=True, max_retries=2, time_limit=10)
def generate_qr_code_async(self, lot_id: int, sample_id: str, site_code: str = 'LL') -> Dict[str, Any]:
    """
    Génération QR code après contrôle SQAL

    Appelée automatiquement après insertion données capteurs.
    Génère QR code et insère produit dans consumer_products.

    Args:
        lot_id: ID du lot
        sample_id: ID échantillon SQAL
        site_code: Code site ('LL', 'LS', 'MT')

    Returns:
        dict: {
            "status": "success",
            "product_id": str,
            "qr_code": str
        }
    """
    try:
        logger.info(f"🏷️ Generating QR code for lot {lot_id}, sample {sample_id}")

        import asyncio

        async def generate_qr():
            conn = await asyncpg.connect(DATABASE_URL)

            # Appeler fonction SQL register_consumer_product
            result = await conn.fetchrow("""
                SELECT * FROM register_consumer_product($1, $2, $3)
            """, lot_id, sample_id, site_code)

            await conn.close()

            if not result:
                raise Exception("Failed to generate QR code (function returned NULL)")

            return {
                "product_id": result['product_id'],
                "qr_code": result['qr_code']
            }

        qr_data = asyncio.run(generate_qr())

        logger.info(f"✅ QR code generated - Product: {qr_data['product_id']}, QR: {qr_data['qr_code'][:50]}...")

        return {
            "status": "success",
            "lot_id": lot_id,
            "sample_id": sample_id,
            "product_id": qr_data['product_id'],
            "qr_code": qr_data['qr_code']
        }

    except Exception as exc:
        logger.error(f"❌ QR code generation failed for lot {lot_id}: {exc}", exc_info=True)
        raise self.retry(exc=exc, countdown=5)


@celery_app.task(time_limit=300)
def weekly_reports_generation() -> Dict[str, Any]:
    """
    Génération hebdomadaire automatique de tous les rapports

    Appelée par Celery Beat tous les lundis à 6h.
    Génère rapports PDF pour tous les sites + exports CSV.

    Returns:
        dict: Résumé génération
    """
    try:
        logger.info("📅 Starting weekly reports generation")

        sites = ['LL', 'LS', 'MT']
        reports_generated = []

        # Dates (lundi dernier → dimanche)
        today = datetime.utcnow()
        date_fin = (today - timedelta(days=today.weekday())).strftime('%Y-%m-%d')
        date_debut = (datetime.strptime(date_fin, '%Y-%m-%d') - timedelta(days=7)).strftime('%Y-%m-%d')

        # Générer rapports pour chaque site
        for site in sites:
            result = generate_site_pdf_report(site, date_debut, date_fin)
            reports_generated.append(result)

        # Export CSV global
        csv_result = export_gavage_data_csv(None, date_debut, date_fin)

        logger.info(f"✅ Weekly reports generation completed - {len(reports_generated)} sites")

        return {
            "status": "success",
            "period": f"{date_debut} → {date_fin}",
            "reports": reports_generated,
            "csv_export": csv_result
        }

    except Exception as exc:
        logger.error(f"❌ Weekly reports generation failed: {exc}", exc_info=True)
        return {"status": "error", "error": str(exc)}
