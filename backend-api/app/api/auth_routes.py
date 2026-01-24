"""
Authentication Routes with Keycloak
"""

from fastapi import APIRouter, Depends, HTTPException, status, Request
from pydantic import BaseModel, EmailStr
from app.auth.keycloak import keycloak_openid, get_current_user
from typing import Optional
import logging
import secrets

logger = logging.getLogger(__name__)

router = APIRouter()


class LoginRequest(BaseModel):
    """Login request model - accepts email for all frontends"""
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    """Token response model"""
    access_token: str
    refresh_token: str
    expires_in: int
    refresh_expires_in: int
    token_type: str = "bearer"
    user_info: Optional[dict] = None


class RefreshRequest(BaseModel):
    """Refresh token request"""
    refresh_token: str


@router.post("/api/auth/login", response_model=TokenResponse)
async def login(credentials: LoginRequest, request: Request):
    """
    Login with Keycloak (with fallback to simple auth)

    Returns JWT access token and refresh token

    FALLBACK: If Keycloak is unavailable, uses simple database authentication
    for gaveurs with password "gaveur123"
    """
    try:
        # Authenticate with Keycloak
        token = keycloak_openid.token(
            username=credentials.email,
            password=credentials.password,
            grant_type="password"
        )

        # Get user info
        try:
            user_info = keycloak_openid.userinfo(token["access_token"])
        except:
            user_info = None

        return TokenResponse(
            access_token=token["access_token"],
            refresh_token=token["refresh_token"],
            expires_in=token["expires_in"],
            refresh_expires_in=token["refresh_expires_in"],
            user_info=user_info
        )

    except Exception as e:
        logger.warning(f"Keycloak login failed: {e}. Trying fallback auth...")

        # FALLBACK: Simple authentication (gaveurs + superviseurs Euralis)
        try:
            # SUPERVISEURS EURALIS (hardcoded pour démo)
            superviseurs = {
                "superviseur@euralis.fr": {
                    "password": "super123",
                    "id": 1,
                    "nom": "Dupont",
                    "prenom": "Marie",
                    "role": "superviseur",
                    "sites": ["LL", "LS", "MT"]
                },
                "admin@euralis.fr": {
                    "password": "admin123",
                    "id": 2,
                    "nom": "Martin",
                    "prenom": "Jean",
                    "role": "admin",
                    "sites": ["LL", "LS", "MT"]
                }
            }

            # Vérifier si c'est un superviseur Euralis
            if credentials.email in superviseurs:
                supervisor = superviseurs[credentials.email]

                if credentials.password != supervisor["password"]:
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="Invalid credentials"
                    )

                # Générer tokens temporaires
                access_token = secrets.token_urlsafe(32)
                refresh_token = secrets.token_urlsafe(32)

                user_info = {
                    "id": supervisor["id"],
                    "name": f"{supervisor['prenom']} {supervisor['nom']}",
                    "email": credentials.email,
                    "preferred_username": credentials.email,
                    "given_name": supervisor["prenom"],
                    "family_name": supervisor["nom"],
                    "role": supervisor["role"],
                    "sites": supervisor["sites"],
                    "is_supervisor": True
                }

                logger.info(f"Supervisor fallback auth successful for {credentials.email}")

                return TokenResponse(
                    access_token=access_token,
                    refresh_token=refresh_token,
                    expires_in=3600,
                    refresh_expires_in=604800,
                    user_info=user_info
                )

            # Sinon, chercher dans les gaveurs
            pool = request.app.state.db_pool

            async with pool.acquire() as conn:
                # Chercher le gaveur par email
                gaveur = await conn.fetchrow(
                    """
                    SELECT id, nom, prenom, email, telephone
                    FROM gaveurs
                    WHERE email = $1
                    """,
                    credentials.email
                )

                if not gaveur:
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="Invalid credentials"
                    )

                # TEMPORAIRE : Vérification simple du mot de passe
                if credentials.password != "gaveur2024":
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="Invalid credentials"
                    )

                # Générer tokens temporaires
                access_token = secrets.token_urlsafe(32)
                refresh_token = secrets.token_urlsafe(32)

                # Créer user_info compatible
                user_info = {
                    "id": gaveur['id'],
                    "name": f"{gaveur['prenom']} {gaveur['nom']}",
                    "email": gaveur['email'],
                    "preferred_username": gaveur['email'],
                    "given_name": gaveur['prenom'],
                    "family_name": gaveur['nom'],
                    "phone": gaveur.get('telephone'),
                    "is_supervisor": False
                }

                # Sauvegarder les infos dans localStorage via user_info
                logger.info(f"Gaveur fallback auth successful for {credentials.email}")

                return TokenResponse(
                    access_token=access_token,
                    refresh_token=refresh_token,
                    expires_in=3600,  # 1 hour
                    refresh_expires_in=604800,  # 7 days
                    user_info=user_info
                )

        except HTTPException:
            raise
        except Exception as fallback_error:
            logger.error(f"Fallback auth also failed: {fallback_error}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication failed"
            )


@router.post("/api/auth/refresh", response_model=TokenResponse)
async def refresh_token(request: RefreshRequest):
    """
    Refresh access token using refresh token
    """
    try:
        token = keycloak_openid.refresh_token(request.refresh_token)

        # Get user info
        try:
            user_info = keycloak_openid.userinfo(token["access_token"])
        except:
            user_info = None

        return TokenResponse(
            access_token=token["access_token"],
            refresh_token=token["refresh_token"],
            expires_in=token["expires_in"],
            refresh_expires_in=token["refresh_expires_in"],
            user_info=user_info
        )

    except Exception as e:
        logger.error(f"Refresh token error: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token"
        )


@router.post("/api/auth/logout")
async def logout(request: RefreshRequest):
    """
    Logout (invalidate refresh token)
    """
    try:
        keycloak_openid.logout(request.refresh_token)
        return {"message": "Logged out successfully"}

    except Exception as e:
        logger.error(f"Logout error: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Logout failed"
        )


@router.get("/api/auth/me")
async def get_current_user_info(current_user = Depends(get_current_user), request: Request = None):
    """
    Get current authenticated user information with gaveur_id enrichment

    Returns:
    - User info from Keycloak token
    - gaveur_id from database (mapped by email or custom attribute)
    - gaveur details (nom, prenom, site, etc.)
    """
    if current_user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated"
        )

    # Try to get gaveur_id from token custom attributes first
    gaveur_id = current_user.get("attributes", {}).get("gaveur_id")

    # If not in token, lookup by email in database
    if not gaveur_id and request and request.app.state.db_pool:
        try:
            async with request.app.state.db_pool.acquire() as conn:
                # Try gaveurs_euralis first (production table with lots)
                gaveur = await conn.fetchrow(
                    """
                    SELECT id, nom, prenom, email, telephone, site_code as site_origine
                    FROM gaveurs_euralis
                    WHERE email = $1
                    """,
                    current_user.get("email")
                )

                # Fallback to gaveurs table if not found
                if not gaveur:
                    gaveur = await conn.fetchrow(
                        """
                        SELECT id, nom, prenom, email, telephone, site_origine
                        FROM gaveurs
                        WHERE email = $1
                        """,
                        current_user.get("email")
                    )

                if gaveur:
                    gaveur_id = gaveur['id']
                    # Enrich user info with gaveur details
                    current_user["gaveur"] = {
                        "id": gaveur['id'],
                        "nom": gaveur['nom'],
                        "prenom": gaveur['prenom'],
                        "email": gaveur['email'],
                        "telephone": gaveur.get('telephone'),
                        "site": gaveur.get('site_origine')
                    }
                    current_user["gaveur_id"] = gaveur_id
        except Exception as e:
            logger.error(f"Failed to enrich user with gaveur info: {e}")

    # Add gaveur_id at root level for easy access
    if gaveur_id:
        current_user["gaveur_id"] = gaveur_id

    return current_user


@router.get("/api/auth/health")
async def health_check():
    """
    Check Keycloak connection health
    """
    try:
        # Try to get public key (tests connection)
        public_key = keycloak_openid.public_key()
        return {
            "status": "healthy",
            "keycloak_connected": True,
            "realm": keycloak_openid.realm_name
        }
    except Exception as e:
        logger.error(f"Keycloak health check failed: {e}")
        return {
            "status": "unhealthy",
            "keycloak_connected": False,
            "error": str(e)
        }
