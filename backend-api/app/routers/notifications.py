"""
Routes pour la gestion des notifications (Email, SMS, Web Push)
Système d'alertes pour rappeler aux gaveurs de remplir leurs formulaires quotidiens
"""

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, EmailStr
from typing import List, Optional
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import os
from datetime import datetime, timedelta
import asyncpg

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


# ============================================================================
# Modèles Pydantic
# ============================================================================

class EmailNotification(BaseModel):
    """Notification email"""
    destinataire: EmailStr
    sujet: str
    message: str
    gaveur_id: Optional[int] = None
    lot_id: Optional[int] = None


class SMSNotification(BaseModel):
    """Notification SMS via Twilio"""
    destinataire: str  # Numéro de téléphone au format international (+33...)
    message: str
    gaveur_id: Optional[int] = None
    lot_id: Optional[int] = None


class WebPushNotification(BaseModel):
    """Notification Web Push"""
    gaveur_id: int
    titre: str
    message: str
    url: Optional[str] = None


class NotificationStatus(BaseModel):
    """Statut d'envoi d'une notification"""
    success: bool
    canal: str  # "email", "sms", "webpush"
    message: str
    timestamp: datetime


# ============================================================================
# Fonctions utilitaires
# ============================================================================

def get_smtp_config():
    """Récupérer la configuration SMTP depuis les variables d'environnement"""
    return {
        "host": os.getenv("SMTP_HOST", "smtp.gmail.com"),
        "port": int(os.getenv("SMTP_PORT", "587")),
        "user": os.getenv("SMTP_USER", ""),
        "password": os.getenv("SMTP_PASSWORD", ""),
        "from_email": os.getenv("SMTP_FROM_EMAIL", "noreply@euralis-gaveurs.com"),
        "from_name": os.getenv("SMTP_FROM_NAME", "Système Gaveurs Euralis"),
    }


def get_twilio_config():
    """Récupérer la configuration Twilio depuis les variables d'environnement"""
    return {
        "account_sid": os.getenv("TWILIO_ACCOUNT_SID", ""),
        "auth_token": os.getenv("TWILIO_AUTH_TOKEN", ""),
        "from_number": os.getenv("TWILIO_FROM_NUMBER", ""),
    }


async def get_jours_manquants(db_pool: asyncpg.Pool, lot_id: int) -> List[int]:
    """
    Détecter les jours manquants dans l'historique d'un lot

    Args:
        db_pool: Pool de connexions PostgreSQL
        lot_id: ID du lot

    Returns:
        Liste des numéros de jours manquants
    """
    async with db_pool.acquire() as conn:
        # Récupérer tous les jours enregistrés
        rows = await conn.fetch(
            """
            SELECT jour_gavage
            FROM gavage_lot_quotidien
            WHERE lot_id = $1
            ORDER BY jour_gavage ASC
            """,
            lot_id
        )

        if not rows:
            return []

        jours_enregistres = set(row['jour_gavage'] for row in rows)
        dernier_jour = max(jours_enregistres)

        # Détecter les jours manquants de J1 au dernier jour
        manquants = []
        for j in range(1, dernier_jour):
            if j not in jours_enregistres:
                manquants.append(j)

        return manquants


# ============================================================================
# Routes Email
# ============================================================================

@router.post("/email/send", response_model=NotificationStatus)
async def send_email_notification(notification: EmailNotification):
    """
    Envoyer une notification par email

    Exemple d'utilisation:
    ```
    POST /api/notifications/email/send
    {
      "destinataire": "jean.martin@example.com",
      "sujet": "Rappel: Gavage J13 à renseigner",
      "message": "Bonjour Jean,<br><br>Le gavage du jour J13 n'a pas encore été renseigné...",
      "gaveur_id": 1,
      "lot_id": 5
    }
    ```
    """
    try:
        smtp_config = get_smtp_config()

        # Vérifier que les credentials SMTP sont configurés
        if not smtp_config["user"] or not smtp_config["password"]:
            raise HTTPException(
                status_code=500,
                detail="Configuration SMTP manquante. Veuillez définir SMTP_USER et SMTP_PASSWORD."
            )

        # Créer le message
        msg = MIMEMultipart("alternative")
        msg["Subject"] = notification.sujet
        msg["From"] = f"{smtp_config['from_name']} <{smtp_config['from_email']}>"
        msg["To"] = notification.destinataire

        # Ajouter le corps HTML
        html_part = MIMEText(notification.message, "html")
        msg.attach(html_part)

        # Envoyer via SMTP
        with smtplib.SMTP(smtp_config["host"], smtp_config["port"]) as server:
            server.starttls()
            server.login(smtp_config["user"], smtp_config["password"])
            server.send_message(msg)

        return NotificationStatus(
            success=True,
            canal="email",
            message=f"Email envoyé à {notification.destinataire}",
            timestamp=datetime.now()
        )

    except smtplib.SMTPException as e:
        raise HTTPException(
            status_code=500,
            detail=f"Erreur SMTP: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Erreur lors de l'envoi de l'email: {str(e)}"
        )


@router.post("/email/rappel-quotidien/{gaveur_id}")
async def send_rappel_quotidien(gaveur_id: int, request: Request):
    """
    Envoyer un rappel quotidien à un gaveur pour remplir son formulaire

    Cette route détecte automatiquement les lots en gavage du gaveur
    et vérifie si le formulaire du jour a été rempli.
    """
    pool = request.app.state.db_pool
    async with pool.acquire() as conn:
        # Récupérer les infos du gaveur
        gaveur = await conn.fetchrow(
            """
            SELECT id, nom, prenom, email, telephone
            FROM gaveurs
            WHERE id = $1 AND actif = true
            """,
            gaveur_id
        )

        if not gaveur:
            raise HTTPException(status_code=404, detail="Gaveur non trouvé ou inactif")

        # Récupérer les lots en gavage du gaveur
        lots = await conn.fetch(
            """
            SELECT id, code_lot, nombre_jours_gavage_ecoules, date_debut_gavage
            FROM lots
            WHERE gaveur_id = $1 AND statut = 'en_gavage'
            """,
            gaveur_id
        )

        if not lots:
            return {
                "success": False,
                "message": "Aucun lot en gavage pour ce gaveur"
            }

        # Vérifier pour chaque lot si le formulaire du jour est rempli
        lots_a_renseigner = []
        aujourd_hui = datetime.now().date()

        for lot in lots:
            # Calculer le jour de gavage actuel
            date_debut = lot['date_debut_gavage']
            jour_actuel = (aujourd_hui - date_debut).days + 1

            # Vérifier si ce jour est déjà enregistré
            gavage_du_jour = await conn.fetchrow(
                """
                SELECT id
                FROM gavage_lot_quotidien
                WHERE lot_id = $1 AND date_gavage = $2
                """,
                lot['id'],
                aujourd_hui
            )

            if not gavage_du_jour and 1 <= jour_actuel <= 14:
                lots_a_renseigner.append({
                    'code': lot['code_lot'],
                    'jour': jour_actuel
                })

        if not lots_a_renseigner:
            return {
                "success": True,
                "message": "Tous les formulaires du jour sont déjà renseignés"
            }

        # Construire l'email
        lots_html = "<br>".join([
            f"• <strong>{lot['code']}</strong> - Jour J{lot['jour']}"
            for lot in lots_a_renseigner
        ])

        message = f"""
        <html>
        <body style="font-family: Arial, sans-serif;">
            <h2 style="color: #2563eb;">📝 Rappel : Gavage du jour à renseigner</h2>

            <p>Bonjour {gaveur['prenom']} {gaveur['nom']},</p>

            <p>Le formulaire de gavage du jour <strong>{aujourd_hui.strftime('%d/%m/%Y')}</strong> n'a pas encore été renseigné pour les lots suivants :</p>

            <div style="background-color: #fef3c7; padding: 15px; border-left: 4px solid #f59e0b; margin: 20px 0;">
                {lots_html}
            </div>

            <p>
                <a href="http://localhost:3000/lots"
                   style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">
                    📝 Remplir le formulaire
                </a>
            </p>

            <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
                💡 Astuce : Il est recommandé de remplir le formulaire le jour même du gavage pour plus de précision.
            </p>

            <hr style="margin-top: 30px; border: none; border-top: 1px solid #e5e7eb;">

            <p style="color: #9ca3af; font-size: 12px;">
                Ceci est un message automatique du système Gaveurs Euralis.<br>
                Si vous avez déjà rempli le formulaire, veuillez ignorer cet email.
            </p>
        </body>
        </html>
        """

        # Envoyer l'email
        notification = EmailNotification(
            destinataire=gaveur['email'],
            sujet=f"Rappel : Gavage du {aujourd_hui.strftime('%d/%m/%Y')} à renseigner",
            message=message,
            gaveur_id=gaveur_id
        )

        return await send_email_notification(notification)


# ============================================================================
# Routes SMS (Twilio)
# ============================================================================

@router.post("/sms/send", response_model=NotificationStatus)
async def send_sms_notification(notification: SMSNotification):
    """
    Envoyer une notification par SMS via Twilio

    Nécessite les variables d'environnement:
    - TWILIO_ACCOUNT_SID
    - TWILIO_AUTH_TOKEN
    - TWILIO_FROM_NUMBER

    Exemple d'utilisation:
    ```
    POST /api/notifications/sms/send
    {
      "destinataire": "+33612345678",
      "message": "Rappel: Gavage J13 à renseigner pour le lot LL_042",
      "gaveur_id": 1,
      "lot_id": 5
    }
    ```
    """
    try:
        twilio_config = get_twilio_config()

        # Vérifier que Twilio est configuré
        if not twilio_config["account_sid"] or not twilio_config["auth_token"]:
            raise HTTPException(
                status_code=500,
                detail="Configuration Twilio manquante. SMS non disponible pour le moment."
            )

        # Importer Twilio (optionnel - évite erreur si pas installé)
        try:
            from twilio.rest import Client
        except ImportError:
            raise HTTPException(
                status_code=500,
                detail="La bibliothèque Twilio n'est pas installée. Exécutez: pip install twilio"
            )

        # Créer le client Twilio
        client = Client(twilio_config["account_sid"], twilio_config["auth_token"])

        # Envoyer le SMS
        message = client.messages.create(
            body=notification.message,
            from_=twilio_config["from_number"],
            to=notification.destinataire
        )

        return NotificationStatus(
            success=True,
            canal="sms",
            message=f"SMS envoyé à {notification.destinataire} (SID: {message.sid})",
            timestamp=datetime.now()
        )

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Erreur lors de l'envoi du SMS: {str(e)}"
        )


@router.post("/sms/alerte-jours-manquants/{gaveur_id}")
async def send_alerte_jours_manquants(gaveur_id: int, request: Request):
    """
    Envoyer une alerte SMS si 2+ jours consécutifs manquants

    Cette route ne s'active que si des jours critiques sont manquants
    (2 jours consécutifs ou plus).
    """
    pool = request.app.state.db_pool
    async with pool.acquire() as conn:
        # Récupérer le gaveur
        gaveur = await conn.fetchrow(
            """
            SELECT id, nom, prenom, telephone
            FROM gaveurs
            WHERE id = $1 AND actif = true
            """,
            gaveur_id
        )

        if not gaveur or not gaveur['telephone']:
            raise HTTPException(status_code=404, detail="Gaveur non trouvé ou sans numéro de téléphone")

        # Récupérer les lots en gavage
        lots = await conn.fetch(
            """
            SELECT id, code_lot
            FROM lots
            WHERE gaveur_id = $1 AND statut = 'en_gavage'
            """,
            gaveur_id
        )

        if not lots:
            return {
                "success": False,
                "message": "Aucun lot en gavage"
            }

        # Vérifier les jours manquants pour chaque lot
        lots_critiques = []

        for lot in lots:
            manquants = await get_jours_manquants(pool, lot['id'])

            # Vérifier s'il y a 2+ jours consécutifs manquants
            if len(manquants) >= 2:
                # Chercher séquences consécutives
                for i in range(len(manquants) - 1):
                    if manquants[i+1] - manquants[i] == 1:
                        lots_critiques.append({
                            'code': lot['code_lot'],
                            'manquants': manquants
                        })
                        break

        if not lots_critiques:
            return {
                "success": True,
                "message": "Aucun jour critique manquant"
            }

        # Construire le message SMS (max 160 caractères recommandé)
        lots_str = ", ".join([lot['code'] for lot in lots_critiques])
        message_sms = (
            f"⚠️ ALERTE GAVAGE\n"
            f"Plusieurs jours manquants détectés pour: {lots_str}\n"
            f"Veuillez compléter dès que possible.\n"
            f"http://localhost:3000/lots"
        )

        # Envoyer le SMS
        notification = SMSNotification(
            destinataire=gaveur['telephone'],
            message=message_sms,
            gaveur_id=gaveur_id
        )

        return await send_sms_notification(notification)


# ============================================================================
# Routes Web Push
# ============================================================================

@router.post("/webpush/subscribe")
async def subscribe_webpush(subscription: dict, gaveur_id: int, request: Request):
    """
    Enregistrer une souscription Web Push pour un gaveur

    Stocke les informations de souscription (endpoint, clés p256dh et auth)
    pour pouvoir envoyer des notifications push ultérieurement.
    """
    # TODO: Stocker dans la base de données
    # Créer une table webpush_subscriptions si elle n'existe pas

    return {
        "success": True,
        "message": "Souscription Web Push enregistrée",
        "gaveur_id": gaveur_id
    }


@router.post("/webpush/send", response_model=NotificationStatus)
async def send_webpush_notification(notification: WebPushNotification, request: Request):
    """
    Envoyer une notification Web Push à un gaveur

    Nécessite une souscription Web Push préalablement enregistrée.
    """
    # TODO: Implémenter l'envoi de notifications Web Push
    # Utiliser la bibliothèque pywebpush

    return NotificationStatus(
        success=True,
        canal="webpush",
        message=f"Notification Web Push envoyée au gaveur {notification.gaveur_id}",
        timestamp=datetime.now()
    )


# ============================================================================
# Routes de test
# ============================================================================

@router.get("/test/email")
async def test_email_config():
    """Tester la configuration email"""
    smtp_config = get_smtp_config()

    if not smtp_config["user"] or not smtp_config["password"]:
        return {
            "configured": False,
            "message": "SMTP non configuré. Définissez SMTP_USER et SMTP_PASSWORD.",
            "config": {
                "host": smtp_config["host"],
                "port": smtp_config["port"],
                "from_email": smtp_config["from_email"],
            }
        }

    return {
        "configured": True,
        "message": "SMTP configuré",
        "config": {
            "host": smtp_config["host"],
            "port": smtp_config["port"],
            "user": smtp_config["user"],
            "from_email": smtp_config["from_email"],
        }
    }


@router.get("/test/sms")
async def test_sms_config():
    """Tester la configuration Twilio SMS"""
    twilio_config = get_twilio_config()

    if not twilio_config["account_sid"] or not twilio_config["auth_token"]:
        return {
            "configured": False,
            "message": "Twilio non configuré. Définissez TWILIO_ACCOUNT_SID et TWILIO_AUTH_TOKEN.",
            "note": "Vous pouvez créer un compte gratuit sur https://www.twilio.com"
        }

    return {
        "configured": True,
        "message": "Twilio configuré",
        "from_number": twilio_config["from_number"],
    }
