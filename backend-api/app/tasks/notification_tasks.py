"""
Tâches de Notification Asynchrones

Envoi de notifications SMS, Email, Alertes qui doivent être déléguées:
- SMS Alerts (via API SMS externe) - 2-5 secondes
- Email Notifications - 1-3 secondes
- Anomaly Alerts (multi-canal) - 5-10 secondes
- Daily Summaries - 10-30 secondes
"""

from app.tasks.celery_app import celery_app
import logging
from typing import Dict, Any, List
import os
import asyncpg
from datetime import datetime, timedelta
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import requests

logger = logging.getLogger(__name__)

# Configuration
DATABASE_URL = os.getenv('DATABASE_URL', 'postgresql://gaveurs_admin:gaveurs_secure_2024@gaveurs_timescaledb:5432/gaveurs_db')
SMS_API_URL = os.getenv('SMS_API_URL', 'https://api.sms-provider.com/send')
SMS_API_KEY = os.getenv('SMS_API_KEY', 'your_sms_api_key')
SMTP_HOST = os.getenv('SMTP_HOST', 'smtp.gmail.com')
SMTP_PORT = int(os.getenv('SMTP_PORT', '587'))
SMTP_USER = os.getenv('SMTP_USER', 'noreply@euralis.com')
SMTP_PASSWORD = os.getenv('SMTP_PASSWORD', 'your_smtp_password')


@celery_app.task(bind=True, max_retries=3, time_limit=30)
def send_sms_alert(self, phone: str, message: str, priority: str = 'normal') -> Dict[str, Any]:
    """
    Envoi SMS d'alerte

    Envoie SMS via API externe (ex: Twilio, OVH, etc.).

    Args:
        phone: Numéro téléphone (+33612345678)
        message: Contenu SMS (max 160 caractères)
        priority: Priorité ('low', 'normal', 'high', 'critical')

    Returns:
        dict: {
            "status": "success",
            "message_id": str,
            "phone": str,
            "sent_at": str
        }
    """
    try:
        logger.info(f"📱 Sending SMS to {phone} - Priority: {priority}")

        # Tronquer message si trop long
        if len(message) > 160:
            message = message[:157] + "..."

        # Appel API SMS
        response = requests.post(
            SMS_API_URL,
            headers={
                "Authorization": f"Bearer {SMS_API_KEY}",
                "Content-Type": "application/json"
            },
            json={
                "to": phone,
                "message": message,
                "priority": priority
            },
            timeout=10
        )

        if response.status_code == 200:
            data = response.json()
            logger.info(f"✅ SMS sent successfully - ID: {data.get('message_id', 'N/A')}")

            return {
                "status": "success",
                "message_id": data.get("message_id", "unknown"),
                "phone": phone,
                "sent_at": datetime.utcnow().isoformat()
            }
        else:
            raise Exception(f"SMS API error: {response.status_code} - {response.text}")

    except Exception as exc:
        logger.error(f"❌ SMS sending failed to {phone}: {exc}", exc_info=True)

        # Retry avec backoff exponentiel
        raise self.retry(exc=exc, countdown=10 * (2 ** self.request.retries))


@celery_app.task(bind=True, max_retries=3, time_limit=30)
def send_email_notification(
    self,
    to_email: str,
    subject: str,
    body_html: str,
    body_text: str = None,
    cc: List[str] = None,
    attachments: List[str] = None
) -> Dict[str, Any]:
    """
    Envoi email de notification

    Envoie email via SMTP avec support HTML et pièces jointes.

    Args:
        to_email: Email destinataire
        subject: Sujet
        body_html: Contenu HTML
        body_text: Contenu texte brut (fallback)
        cc: Liste emails en copie
        attachments: Liste chemins fichiers à joindre

    Returns:
        dict: Statut envoi
    """
    try:
        logger.info(f"📧 Sending email to {to_email} - Subject: {subject}")

        # Créer message
        msg = MIMEMultipart('alternative')
        msg['From'] = SMTP_USER
        msg['To'] = to_email
        msg['Subject'] = subject

        if cc:
            msg['Cc'] = ', '.join(cc)

        # Corps texte brut
        if body_text:
            part_text = MIMEText(body_text, 'plain', 'utf-8')
            msg.attach(part_text)

        # Corps HTML
        part_html = MIMEText(body_html, 'html', 'utf-8')
        msg.attach(part_html)

        # Pièces jointes (si présentes)
        if attachments:
            from email.mime.base import MIMEBase
            from email import encoders

            for filepath in attachments:
                if os.path.exists(filepath):
                    with open(filepath, 'rb') as f:
                        part = MIMEBase('application', 'octet-stream')
                        part.set_payload(f.read())
                        encoders.encode_base64(part)
                        part.add_header(
                            'Content-Disposition',
                            f'attachment; filename={os.path.basename(filepath)}'
                        )
                        msg.attach(part)

        # Envoi SMTP
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASSWORD)
            recipients = [to_email] + (cc or [])
            server.sendmail(SMTP_USER, recipients, msg.as_string())

        logger.info(f"✅ Email sent successfully to {to_email}")

        return {
            "status": "success",
            "to_email": to_email,
            "subject": subject,
            "sent_at": datetime.utcnow().isoformat()
        }

    except Exception as exc:
        logger.error(f"❌ Email sending failed to {to_email}: {exc}", exc_info=True)
        raise self.retry(exc=exc, countdown=15 * (2 ** self.request.retries))


@celery_app.task(time_limit=60)
def send_anomaly_alert(site_code: str, anomalies: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Envoi alertes anomalies détectées

    Envoie SMS + Email aux responsables site en cas d'anomalies critiques.

    Args:
        site_code: Code site ('LL', 'LS', 'MT')
        anomalies: Liste anomalies critiques

    Returns:
        dict: Résumé envois
    """
    try:
        logger.info(f"🚨 Sending anomaly alerts for site {site_code} - {len(anomalies)} anomalies")

        # Récupérer contacts site
        import asyncio
        from app.services.site_contacts import get_site_contacts

        contacts = asyncio.run(get_site_contacts(site_code))

        if not contacts:
            logger.warning(f"No contacts found for site {site_code}")
            return {"status": "warning", "message": "No contacts"}

        # Composer message
        anomaly_summary = "\n".join([
            f"- Lot {a.get('lot_id', 'N/A')}: {a.get('type', 'Unknown')} ({a.get('severity', 'N/A')})"
            for a in anomalies[:5]  # Limiter à 5 pour SMS
        ])

        sms_message = f"⚠️ ALERTE {site_code}: {len(anomalies)} anomalie(s) détectée(s).\n{anomaly_summary}"

        email_subject = f"⚠️ Alerte Anomalies - Site {site_code}"
        email_body_html = f"""
        <html>
        <body>
            <h2>Alerte Anomalies - Site {site_code}</h2>
            <p><strong>{len(anomalies)} anomalie(s) critique(s) détectée(s)</strong></p>
            <ul>
                {"".join([f"<li>Lot {a.get('lot_id', 'N/A')}: {a.get('description', 'N/A')} (Sévérité: {a.get('severity', 'N/A')})</li>" for a in anomalies])}
            </ul>
            <p>Consultez le dashboard Euralis pour plus de détails.</p>
        </body>
        </html>
        """

        # Envoi multi-canal
        sms_results = []
        email_results = []

        for contact in contacts:
            # SMS si numéro présent et anomalies critiques
            if contact.get('phone') and len([a for a in anomalies if a.get('severity') == 'critical']) > 0:
                sms_result = send_sms_alert(contact['phone'], sms_message, priority='high')
                sms_results.append(sms_result)

            # Email toujours
            if contact.get('email'):
                email_result = send_email_notification(
                    to_email=contact['email'],
                    subject=email_subject,
                    body_html=email_body_html
                )
                email_results.append(email_result)

        logger.info(f"✅ Anomaly alerts sent - SMS: {len(sms_results)}, Email: {len(email_results)}")

        return {
            "status": "success",
            "site_code": site_code,
            "nb_anomalies": len(anomalies),
            "sms_sent": len(sms_results),
            "emails_sent": len(email_results)
        }

    except Exception as exc:
        logger.error(f"❌ Anomaly alert sending failed: {exc}", exc_info=True)
        return {"status": "error", "error": str(exc)}


@celery_app.task(time_limit=60)
def send_lot_completion_notification(lot_id: int) -> Dict[str, Any]:
    """
    Notification fin de gavage d'un lot

    Envoie email au gaveur + responsable site à la fin du gavage (jour 14).

    Args:
        lot_id: ID du lot terminé

    Returns:
        dict: Statut envoi
    """
    try:
        logger.info(f"🎉 Sending lot completion notification for lot {lot_id}")

        import asyncio
        from app.services.lot_info import get_lot_completion_info

        # Récupérer infos lot
        lot_info = asyncio.run(get_lot_completion_info(lot_id))

        if not lot_info:
            return {"status": "error", "message": "Lot not found"}

        # Email gaveur
        email_subject = f"🎉 Lot {lot_info['code_lot']} terminé avec succès"
        email_body_html = f"""
        <html>
        <body>
            <h2>Félicitations ! Lot {lot_info['code_lot']} terminé</h2>
            <p>Bonjour {lot_info['gaveur_nom']},</p>
            <p>Votre lot a été gavé pendant 14 jours avec succès.</p>
            <h3>Résultats finaux:</h3>
            <ul>
                <li>Poids moyen final: <strong>{lot_info['poids_final']} g</strong></li>
                <li>ITM atteint: <strong>{lot_info['itm_final']}</strong></li>
                <li>Taux de mortalité: <strong>{lot_info['taux_mortalite']}%</strong></li>
                <li>Canards vivants: <strong>{lot_info['nb_vivants']}</strong></li>
            </ul>
            <p>Le lot sera transféré vers l'abattoir prochainement.</p>
            <p>Merci pour votre travail !</p>
        </body>
        </html>
        """

        # Envoi email
        result = send_email_notification(
            to_email=lot_info['gaveur_email'],
            subject=email_subject,
            body_html=email_body_html
        )

        logger.info(f"✅ Lot completion notification sent to {lot_info['gaveur_email']}")

        return {
            "status": "success",
            "lot_id": lot_id,
            "gaveur_email": lot_info['gaveur_email'],
            "email_sent": result['status'] == 'success'
        }

    except Exception as exc:
        logger.error(f"❌ Lot completion notification failed: {exc}", exc_info=True)
        return {"status": "error", "error": str(exc)}


@celery_app.task(time_limit=120)
def send_daily_summary_reports() -> Dict[str, Any]:
    """
    Envoi rapports quotidiens automatiques

    Appelée par Celery Beat tous les jours à 18h.
    Envoie résumé journalier à tous les responsables sites.

    Returns:
        dict: Résumé envois
    """
    try:
        logger.info("📅 Sending daily summary reports")

        import asyncio
        from app.services.daily_summary import generate_daily_summaries

        # Générer résumés pour chaque site
        summaries = asyncio.run(generate_daily_summaries())

        emails_sent = 0

        for summary in summaries:
            site_code = summary['site_code']
            contacts = summary['contacts']

            email_subject = f"📊 Résumé Journalier - Site {site_code}"
            email_body_html = f"""
            <html>
            <body>
                <h2>Résumé Journalier - Site {site_code}</h2>
                <h3>Aujourd'hui ({summary['date']}):</h3>
                <ul>
                    <li>Lots en cours: <strong>{summary['lots_en_cours']}</strong></li>
                    <li>Repas gavage: <strong>{summary['nb_repas']}</strong></li>
                    <li>Dose moyenne: <strong>{summary['dose_moyenne']} g</strong></li>
                    <li>Alertes: <strong>{summary['nb_alertes']}</strong></li>
                    <li>Échantillons SQAL: <strong>{summary['nb_sqal_samples']}</strong></li>
                </ul>
                <h3>Performance:</h3>
                <ul>
                    <li>ITM moyen: <strong>{summary['itm_moyen']}</strong></li>
                    <li>Taux mortalité: <strong>{summary['taux_mortalite']}%</strong></li>
                </ul>
                <p>Consultez le dashboard Euralis pour plus de détails.</p>
            </body>
            </html>
            """

            # Envoi à tous les contacts site
            for contact in contacts:
                if contact.get('email'):
                    send_email_notification(
                        to_email=contact['email'],
                        subject=email_subject,
                        body_html=email_body_html
                    )
                    emails_sent += 1

        logger.info(f"✅ Daily summary reports sent - {emails_sent} emails")

        return {
            "status": "success",
            "date": datetime.utcnow().strftime('%Y-%m-%d'),
            "emails_sent": emails_sent,
            "sites_processed": len(summaries)
        }

    except Exception as exc:
        logger.error(f"❌ Daily summary reports failed: {exc}", exc_info=True)
        return {"status": "error", "error": str(exc)}


@celery_app.task(time_limit=60)
def send_consumer_feedback_acknowledgment(feedback_id: int) -> Dict[str, Any]:
    """
    Envoi email de remerciement après feedback consommateur

    Envoie email au consommateur pour le remercier de son feedback.

    Args:
        feedback_id: ID du feedback

    Returns:
        dict: Statut envoi
    """
    try:
        logger.info(f"💌 Sending consumer feedback acknowledgment for feedback {feedback_id}")

        import asyncio
        from app.services.feedback_info import get_feedback_info

        # Récupérer infos feedback
        feedback = asyncio.run(get_feedback_info(feedback_id))

        if not feedback or not feedback.get('consumer_email'):
            return {"status": "warning", "message": "No email provided"}

        email_subject = "Merci pour votre avis !"
        email_body_html = f"""
        <html>
        <body>
            <h2>Merci pour votre avis !</h2>
            <p>Cher(e) client(e),</p>
            <p>Nous vous remercions d'avoir pris le temps de partager votre avis sur notre produit.</p>
            <p>Votre note: <strong>{feedback['rating']}/5 ⭐</strong></p>
            <p>Vos retours nous aident à améliorer continuellement la qualité de nos produits.</p>
            <p>Cordialement,<br>L'équipe Euralis</p>
        </body>
        </html>
        """

        result = send_email_notification(
            to_email=feedback['consumer_email'],
            subject=email_subject,
            body_html=email_body_html
        )

        logger.info(f"✅ Feedback acknowledgment sent to {feedback['consumer_email']}")

        return {
            "status": "success",
            "feedback_id": feedback_id,
            "consumer_email": feedback['consumer_email']
        }

    except Exception as exc:
        logger.error(f"❌ Feedback acknowledgment failed: {exc}", exc_info=True)
        return {"status": "error", "error": str(exc)}
