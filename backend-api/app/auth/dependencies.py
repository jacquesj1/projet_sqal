"""
FastAPI Authentication Dependencies
====================================

Dépendances pour l'authentification dans les routes:
- get_current_user: Extrait l'utilisateur du token JWT
- get_current_gaveur: Vérifie que l'utilisateur est un gaveur
- get_current_supervisor: Vérifie que l'utilisateur est un superviseur
"""

from typing import Optional
from fastapi import Depends, HTTPException, status, Header
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from .jwt_handler import decode_access_token, TokenData, is_token_expired


# =============================================================================
# SECURITY SCHEME
# =============================================================================

security = HTTPBearer()


# =============================================================================
# DEPENDENCY FUNCTIONS
# =============================================================================

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> TokenData:
    """
    Extrait et valide l'utilisateur depuis le token JWT

    Usage dans les routes:
        @router.get("/protected")
        async def protected_route(current_user: TokenData = Depends(get_current_user)):
            return {"user_id": current_user.user_id}

    Args:
        credentials: Credentials HTTP Bearer automatiquement extraits

    Returns:
        TokenData: Données de l'utilisateur

    Raises:
        HTTPException: Si le token est invalide ou expiré
    """
    token = credentials.credentials

    # Décoder le token
    token_data = decode_access_token(token)

    if token_data is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token invalide ou expiré",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Vérifier l'expiration
    if is_token_expired(token_data):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token expiré",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return token_data


async def get_current_gaveur(
    current_user: TokenData = Depends(get_current_user)
) -> TokenData:
    """
    Vérifie que l'utilisateur connecté est un gaveur

    Usage dans les routes:
        @router.get("/gaveur/dashboard")
        async def gaveur_dashboard(gaveur: TokenData = Depends(get_current_gaveur)):
            return {"gaveur_id": gaveur.user_id}

    Args:
        current_user: Utilisateur actuel (automatiquement injecté)

    Returns:
        TokenData: Données du gaveur

    Raises:
        HTTPException: Si l'utilisateur n'est pas un gaveur
    """
    if current_user.user_type != "gaveur":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Accès réservé aux gaveurs"
        )

    return current_user


async def get_current_supervisor(
    current_user: TokenData = Depends(get_current_user)
) -> TokenData:
    """
    Vérifie que l'utilisateur connecté est un superviseur Euralis

    Usage dans les routes:
        @router.get("/euralis/dashboard")
        async def euralis_dashboard(supervisor: TokenData = Depends(get_current_supervisor)):
            return {"supervisor_id": supervisor.user_id}

    Args:
        current_user: Utilisateur actuel (automatiquement injecté)

    Returns:
        TokenData: Données du superviseur

    Raises:
        HTTPException: Si l'utilisateur n'est pas un superviseur
    """
    if current_user.user_type != "supervisor":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Accès réservé aux superviseurs Euralis"
        )

    return current_user


async def get_current_admin(
    current_user: TokenData = Depends(get_current_user)
) -> TokenData:
    """
    Vérifie que l'utilisateur connecté est un administrateur

    Usage dans les routes:
        @router.delete("/admin/user/{user_id}")
        async def delete_user(user_id: int, admin: TokenData = Depends(get_current_admin)):
            # Code admin only

    Args:
        current_user: Utilisateur actuel (automatiquement injecté)

    Returns:
        TokenData: Données de l'admin

    Raises:
        HTTPException: Si l'utilisateur n'est pas admin
    """
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Accès réservé aux administrateurs"
        )

    return current_user


# =============================================================================
# OPTIONAL AUTH
# =============================================================================

async def get_optional_user(
    authorization: Optional[str] = Header(None)
) -> Optional[TokenData]:
    """
    Extrait l'utilisateur si un token est fourni (authentification optionnelle)

    Usage dans les routes:
        @router.get("/public/data")
        async def public_data(user: Optional[TokenData] = Depends(get_optional_user)):
            if user:
                # Contenu personnalisé
            else:
                # Contenu public

    Args:
        authorization: Header Authorization (optionnel)

    Returns:
        TokenData si token valide, None sinon
    """
    if not authorization:
        return None

    # Extraire le token du header "Bearer <token>"
    try:
        scheme, token = authorization.split()
        if scheme.lower() != "bearer":
            return None
    except ValueError:
        return None

    # Décoder le token
    token_data = decode_access_token(token)

    if token_data is None or is_token_expired(token_data):
        return None

    return token_data
