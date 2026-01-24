import os
from typing import Optional
from twilio.rest import Client
import requests
from datetime import datetime
import logging
from app.models.schemas import SMSNotification, AlerteNiveauEnum

logger = logging.getLogger(__name__)


class SMSService:
    """
    Service d'envoi de SMS avec support multi-providers (Twilio, OVH)

    Lazy initialization: Le client Twilio n'est créé que lors du premier envoi de SMS
    """

    def __init__(self):
        self.provider = os.getenv("SMS_PROVIDER", "twilio").lower()

        # Configuration Twilio
        self.twilio_account_sid = os.getenv("TWILIO_ACCOUNT_SID")
        self.twilio_auth_token = os.getenv("TWILIO_AUTH_TOKEN")
        self.twilio_phone_number = os.getenv("TWILIO_PHONE_NUMBER")

        # Configuration OVH
        self.ovh_account = os.getenv("OVH_SMS_ACCOUNT")
        self.ovh_login = os.getenv("OVH_SMS_LOGIN")
        self.ovh_password = os.getenv("OVH_SMS_PASSWORD")
        self.ovh_sender = os.getenv("OVH_SMS_SENDER", "Gaveurs")

        # Client Twilio (lazy initialization)
        self._client = None

        # SMS enabled flag
        self.sms_enabled = self._check_sms_enabled()

        self.sms_history = []

        if not self.sms_enabled:
            logger.warning(
                "⚠️  SMS service disabled - Missing credentials. "
                "Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN to enable SMS notifications."
            )

    def _check_sms_enabled(self) -> bool:
        """
        Check if SMS service is properly configured
        """
        if self.provider == "twilio":
            return bool(self.twilio_account_sid and self.twilio_auth_token and self.twilio_phone_number)
        elif self.provider == "ovh":
            return bool(self.ovh_account and self.ovh_login and self.ovh_password)
        return False

    @property
    def client(self):
        """
        Lazy initialization of Twilio client
        Only creates the client when first SMS is sent
        """
        if self._client is None and self.provider == "twilio":
            if not self.sms_enabled:
                raise Exception(
                    "SMS service not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, "
                    "and TWILIO_PHONE_NUMBER environment variables."
                )
            self._client = Client(self.twilio_account_sid, self.twilio_auth_token)
            logger.info("✅ Twilio SMS client initialized")
        return self._client
    
    async def send_sms(self, notification: SMSNotification) -> bool:
        """
        Envoie un SMS via le provider configuré

        Args:
            notification: Objet SMSNotification avec destinataire et message

        Returns:
            bool: True si envoyé avec succès
        """
        # Check if SMS is enabled
        if not self.sms_enabled:
            logger.warning(
                f"⚠️  SMS not sent - Service disabled. "
                f"To: {notification.phone_number}, Message: {notification.message[:50]}..."
            )
            return False

        try:
            if self.provider == "twilio":
                return await self._send_twilio(notification)
            elif self.provider == "ovh":
                return await self._send_ovh(notification)
            else:
                logger.error(f"Provider SMS inconnu: {self.provider}")
                return False

        except Exception as e:
            logger.error(f"Erreur envoi SMS: {str(e)}")
            return False
    
    async def _send_twilio(self, notification: SMSNotification) -> bool:
        """Envoi via Twilio"""
        try:
            message = self.client.messages.create(
                body=notification.message,
                from_=self.twilio_phone_number,
                to=notification.destinataire
            )
            
            self._log_sms(notification, message.sid, "twilio")
            logger.info(f"SMS Twilio envoyé: {message.sid}")
            return True
            
        except Exception as e:
            logger.error(f"Erreur Twilio: {str(e)}")
            return False
    
    async def _send_ovh(self, notification: SMSNotification) -> bool:
        """Envoi via OVH SMS API"""
        try:
            url = f"https://www.ovh.com/cgi-bin/sms/http2sms.cgi"
            
            params = {
                "account": self.ovh_account,
                "login": self.ovh_login,
                "password": self.ovh_password,
                "from": self.ovh_sender,
                "to": notification.destinataire,
                "message": notification.message,
                "contentType": "text/plain",
                "class": self._get_ovh_class(notification.priorite)
            }
            
            response = requests.get(url, params=params, timeout=10)
            
            if response.status_code == 200 and "OK" in response.text:
                self._log_sms(notification, response.text, "ovh")
                logger.info(f"SMS OVH envoyé: {response.text}")
                return True
            else:
                logger.error(f"Erreur OVH: {response.text}")
                return False
                
        except Exception as e:
            logger.error(f"Erreur OVH: {str(e)}")
            return False
    
    def _get_ovh_class(self, priorite: AlerteNiveauEnum) -> str:
        """Détermine la classe OVH selon la priorité"""
        if priorite == AlerteNiveauEnum.CRITIQUE:
            return "0"  # Flash - prioritaire
        elif priorite == AlerteNiveauEnum.IMPORTANT:
            return "1"  # Standard +
        else:
            return "2"  # Standard
    
    def _log_sms(self, notification: SMSNotification, message_id: str, provider: str):
        """Log l'historique des SMS envoyés"""
        self.sms_history.append({
            "timestamp": datetime.utcnow(),
            "destinataire": notification.destinataire,
            "message": notification.message,
            "type_alerte": notification.type_alerte,
            "priorite": notification.priorite,
            "message_id": message_id,
            "provider": provider
        })
    
    async def send_alerte_critique(
        self, 
        telephone: str, 
        canard_id: int, 
        message: str
    ) -> bool:
        """
        Envoi rapide d'alerte critique
        
        Args:
            telephone: Numéro du destinataire
            canard_id: ID du canard concerné
            message: Message d'alerte
        """
        notification = SMSNotification(
            destinataire=telephone,
            message=f"🚨 ALERTE CANARD #{canard_id}: {message}",
            type_alerte="critique",
            priorite=AlerteNiveauEnum.CRITIQUE
        )
        
        return await self.send_sms(notification)
    
    async def send_correction_dose(
        self,
        telephone: str,
        canard_id: int,
        dose_theorique: float,
        dose_reelle: float,
        correction: str
    ) -> bool:
        """
        Envoi SMS de correction de dose
        
        Args:
            telephone: Numéro du gaveur
            canard_id: ID du canard
            dose_theorique: Dose recommandée par l'IA
            dose_reelle: Dose effectivement donnée
            correction: Message de correction
        """
        ecart = abs(dose_theorique - dose_reelle)
        ecart_pct = (ecart / dose_theorique * 100) if dose_theorique > 0 else 0
        
        message = (
            f"📊 CORRECTION Canard #{canard_id}\n"
            f"Théorique: {dose_theorique:.0f}g\n"
            f"Réelle: {dose_reelle:.0f}g\n"
            f"Écart: {ecart:.0f}g ({ecart_pct:.1f}%)\n"
            f"➡️ {correction}"
        )
        
        notification = SMSNotification(
            destinataire=telephone,
            message=message,
            type_alerte="correction_dose",
            priorite=AlerteNiveauEnum.IMPORTANT
        )
        
        return await self.send_sms(notification)
    
    async def send_rappel_gavage(
        self,
        telephone: str,
        session: str,
        nombre_canards: int
    ) -> bool:
        """Rappel de session de gavage"""
        message = f"⏰ Rappel gavage {session}: {nombre_canards} canard(s) à gaver"
        
        notification = SMSNotification(
            destinataire=telephone,
            message=message,
            type_alerte="rappel",
            priorite=AlerteNiveauEnum.INFO
        )
        
        return await self.send_sms(notification)
    
    def get_sms_stats(self) -> dict:
        """Statistiques d'envoi de SMS"""
        total = len(self.sms_history)
        if total == 0:
            return {"total": 0}
        
        par_type = {}
        par_priorite = {}
        
        for sms in self.sms_history:
            type_alerte = sms["type_alerte"]
            priorite = sms["priorite"]
            
            par_type[type_alerte] = par_type.get(type_alerte, 0) + 1
            par_priorite[priorite] = par_priorite.get(priorite, 0) + 1
        
        return {
            "total": total,
            "par_type": par_type,
            "par_priorite": par_priorite,
            "provider": self.provider,
            "dernier_envoi": self.sms_history[-1]["timestamp"] if total > 0 else None
        }


# Instance globale du service SMS
sms_service = SMSService()
