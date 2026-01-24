"""
JWT Token Handler
==================

Gestion des tokens JWT pour l'authentification:
- Génération de tokens (access + refresh)
- Validation et décodage
- Extraction des claims
- Gestion de l'expiration
"""

from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel
import secrets


# =============================================================================
# CONFIGURATION
# =============================================================================

# TODO: En production, stocker ces valeurs dans des variables d'environnement
SECRET_KEY = "euralis-gaveurs-super-secret-key-change-in-production-2024"
REFRESH_SECRET_KEY = "euralis-gaveurs-refresh-secret-key-change-in-production-2024"
ALGORITHM = "HS256"

# Durées de validité
ACCESS_TOKEN_EXPIRE_MINUTES = 60  # 1 heure
REFRESH_TOKEN_EXPIRE_DAYS = 7     # 7 jours

# Contexte pour hasher les mots de passe
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# =============================================================================
# MODELS
# =============================================================================

class TokenData(BaseModel):
    """Données extraites du token JWT"""
    user_id: int
    email: str
    role: str
    user_type: str  # "gaveur" ou "supervisor"
    exp: Optional[datetime] = None


class TokenPair(BaseModel):
    """Paire de tokens (access + refresh)"""
    access_token: str
    refresh_token: str
    token_type: str = "Bearer"
    expires_in: int = ACCESS_TOKEN_EXPIRE_MINUTES * 60  # En secondes


# =============================================================================
# PASSWORD HASHING
# =============================================================================

def hash_password(password: str) -> str:
    """Hash un mot de passe avec bcrypt"""
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Vérifie un mot de passe contre son hash"""
    return pwd_context.verify(plain_password, hashed_password)


# =============================================================================
# JWT TOKEN GENERATION
# =============================================================================

def create_access_token(
    data: Dict[str, Any],
    expires_delta: Optional[timedelta] = None
) -> str:
    """
    Crée un access token JWT

    Args:
        data: Données à encoder dans le token (user_id, email, role, etc.)
        expires_delta: Durée de validité personnalisée (optionnel)

    Returns:
        Token JWT encodé
    """
    to_encode = data.copy()

    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode.update({
        "exp": expire,
        "iat": datetime.utcnow(),  # Issued at
        "type": "access"
    })

    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def create_refresh_token(
    data: Dict[str, Any],
    expires_delta: Optional[timedelta] = None
) -> str:
    """
    Crée un refresh token JWT

    Args:
        data: Données à encoder dans le token (user_id, email)
        expires_delta: Durée de validité personnalisée (optionnel)

    Returns:
        Refresh token JWT encodé
    """
    to_encode = data.copy()

    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)

    # Ajouter un JTI (JWT ID) unique pour permettre la révocation
    jti = secrets.token_urlsafe(32)

    to_encode.update({
        "exp": expire,
        "iat": datetime.utcnow(),
        "type": "refresh",
        "jti": jti
    })

    encoded_jwt = jwt.encode(to_encode, REFRESH_SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def create_token_pair(user_data: Dict[str, Any]) -> TokenPair:
    """
    Crée une paire de tokens (access + refresh)

    Args:
        user_data: Données utilisateur à encoder (user_id, email, role, user_type)

    Returns:
        TokenPair avec access_token et refresh_token
    """
    access_token = create_access_token(data=user_data)
    refresh_token = create_refresh_token(data={
        "user_id": user_data["user_id"],
        "email": user_data["email"],
        "user_type": user_data["user_type"]
    })

    return TokenPair(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60
    )


# =============================================================================
# JWT TOKEN VALIDATION
# =============================================================================

def decode_access_token(token: str) -> Optional[TokenData]:
    """
    Décode et valide un access token

    Args:
        token: Token JWT à décoder

    Returns:
        TokenData si valide, None sinon
    """
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])

        # Vérifier le type de token
        if payload.get("type") != "access":
            return None

        # Extraire les données
        user_id: int = payload.get("user_id")
        email: str = payload.get("email")
        role: str = payload.get("role")
        user_type: str = payload.get("user_type")
        exp: datetime = datetime.fromtimestamp(payload.get("exp"))

        if user_id is None or email is None:
            return None

        return TokenData(
            user_id=user_id,
            email=email,
            role=role or "user",
            user_type=user_type or "gaveur",
            exp=exp
        )

    except JWTError:
        return None


def decode_refresh_token(token: str) -> Optional[Dict[str, Any]]:
    """
    Décode et valide un refresh token

    Args:
        token: Refresh token JWT à décoder

    Returns:
        Payload du token si valide, None sinon
    """
    try:
        payload = jwt.decode(token, REFRESH_SECRET_KEY, algorithms=[ALGORITHM])

        # Vérifier le type de token
        if payload.get("type") != "refresh":
            return None

        return payload

    except JWTError:
        return None


# =============================================================================
# TOKEN EXPIRATION CHECK
# =============================================================================

def is_token_expired(token_data: TokenData) -> bool:
    """
    Vérifie si un token est expiré

    Args:
        token_data: Données du token

    Returns:
        True si expiré, False sinon
    """
    if token_data.exp is None:
        return True

    return datetime.utcnow() > token_data.exp


def get_token_expiry(token_data: TokenData) -> Optional[int]:
    """
    Retourne le temps restant avant expiration (en secondes)

    Args:
        token_data: Données du token

    Returns:
        Secondes restantes, ou None si déjà expiré
    """
    if token_data.exp is None:
        return None

    delta = token_data.exp - datetime.utcnow()
    seconds = int(delta.total_seconds())

    return seconds if seconds > 0 else None
