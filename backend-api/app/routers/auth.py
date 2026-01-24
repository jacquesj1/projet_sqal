"""
Routes d'authentification pour les gaveurs et superviseurs
===========================================================

Authentification JWT avec access tokens et refresh tokens:
- Login gaveur/superviseur
- Refresh token
- Logout
- Récupération informations utilisateur
"""

from fastapi import APIRouter, HTTPException, Request, Depends, status
from pydantic import BaseModel, EmailStr, validator
from typing import Optional
from app.auth import (
    create_token_pair,
    verify_password,
    hash_password,
    decode_refresh_token,
    get_current_user,
    get_current_gaveur,
    get_current_supervisor,
    TokenData,
    TokenPair,
)

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


# =============================================================================
# MODELS
# =============================================================================

class LoginRequest(BaseModel):
    """Requête de connexion - accepte email OU username"""
    email: Optional[str] = None  # Changé de EmailStr à str pour accepter username aussi
    username: Optional[str] = None
    password: str

    @validator('password')
    def validate_email_or_username(cls, v, values):
        """S'assurer qu'au moins email ou username est fourni"""
        if not values.get('email') and not values.get('username'):
            raise ValueError('Email ou username requis')
        return v


class RefreshRequest(BaseModel):
    """Requête de refresh token"""
    refresh_token: str


class LogoutRequest(BaseModel):
    """Requête de déconnexion"""
    refresh_token: str


class UserInfoResponse(BaseModel):
    """Informations utilisateur"""
    id: int
    email: str
    nom: str
    prenom: str
    role: str
    user_type: str
    sites: Optional[list[str]] = None


class LoginResponse(BaseModel):
    """Réponse de login avec tokens et infos utilisateur"""
    access_token: str
    refresh_token: str
    token_type: str = "Bearer"
    expires_in: int
    user_info: dict


# =============================================================================
# AUTHENTIFICATION GAVEUR
# =============================================================================

@router.post("/gaveur/login", response_model=LoginResponse)
async def login_gaveur(credentials: LoginRequest, request: Request):
    """
    Authentification gaveur avec JWT

    Credentials de test:
    - Email: jean.martin@gaveur.fr
    - Password: gaveur123

    Returns:
        LoginResponse: access_token, refresh_token et user_info
    """
    pool = request.app.state.db_pool

    async with pool.acquire() as conn:
        # Chercher le gaveur par email
        gaveur = await conn.fetchrow(
            """
            SELECT id, nom, prenom, email, telephone, site_origine, password_hash
            FROM gaveurs
            WHERE email = $1
            """,
            credentials.email
        )

        if not gaveur:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Email ou mot de passe invalide"
            )

        # Vérifier le mot de passe
        # TEMPORAIRE: Si pas de hash en base, accepter "gaveur123" pour migration
        if gaveur['password_hash']:
            if not verify_password(credentials.password, gaveur['password_hash']):
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Email ou mot de passe invalide"
                )
        else:
            # Migration: accepter gaveur123 et hasher le mot de passe
            if credentials.password != "gaveur123":
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Email ou mot de passe invalide"
                )
            # Hasher le mot de passe pour la prochaine fois
            hashed = hash_password(credentials.password)
            await conn.execute(
                "UPDATE gaveurs SET password_hash = $1 WHERE id = $2",
                hashed, gaveur['id']
            )

        # Créer les tokens JWT
        token_pair = create_token_pair({
            "user_id": gaveur['id'],
            "email": gaveur['email'],
            "role": "gaveur",
            "user_type": "gaveur",
        })

        # Retourner tokens + infos utilisateur
        return LoginResponse(
            access_token=token_pair.access_token,
            refresh_token=token_pair.refresh_token,
            token_type=token_pair.token_type,
            expires_in=token_pair.expires_in,
            user_info={
                "id": gaveur['id'],
                "email": gaveur['email'],
                "nom": gaveur['nom'],
                "prenom": gaveur['prenom'],
                "name": f"{gaveur['prenom']} {gaveur['nom']}",  # Pour compatibilité frontend
                "role": "gaveur",
                "user_type": "gaveur",
                "site": gaveur['site_origine']
            }
        )


@router.get("/gaveur/me", response_model=UserInfoResponse)
async def get_current_gaveur_info(
    request: Request,
    current_gaveur: TokenData = Depends(get_current_gaveur)
):
    """
    Récupérer informations du gaveur connecté

    Requiert: Token JWT valide de type gaveur
    """
    pool = request.app.state.db_pool

    async with pool.acquire() as conn:
        gaveur = await conn.fetchrow(
            """
            SELECT id, nom, prenom, email, telephone, site_origine
            FROM gaveurs
            WHERE id = $1
            """,
            current_gaveur.user_id
        )

        if not gaveur:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Gaveur non trouvé"
            )

        return UserInfoResponse(
            id=gaveur['id'],
            email=gaveur['email'],
            nom=gaveur['nom'],
            prenom=gaveur['prenom'],
            role="gaveur",
            user_type="gaveur",
            sites=[gaveur['site_origine']] if gaveur['site_origine'] else []
        )


# =============================================================================
# AUTHENTIFICATION SUPERVISEUR EURALIS
# =============================================================================

@router.post("/login", response_model=LoginResponse)
async def login_unified(credentials: LoginRequest, request: Request):
    """
    Authentification UNIFIÉE - Gaveur OU Superviseur avec JWT

    Détecte automatiquement le type d'utilisateur:
    1. Cherche d'abord dans la table gaveurs (DB)
    2. Si pas trouvé, cherche dans les superviseurs (hardcodé)

    Credentials de test:
    - Superviseur: superviseur@euralis.fr / super123
    - Admin: admin@euralis.fr / admin123
    - Gaveur: N'importe quel email de gaveur en DB / gaveur123

    Returns:
        LoginResponse: access_token, refresh_token et user_info
    """
    pool = request.app.state.db_pool
    lookup_email = credentials.email or credentials.username

    # ========================================================================
    # ÉTAPE 1: Chercher dans la table GAVEURS (base de données)
    # ========================================================================
    async with pool.acquire() as conn:
        gaveur = await conn.fetchrow(
            """
            SELECT id, nom, prenom, email, telephone, site_origine, password_hash
            FROM gaveurs
            WHERE email = $1
            """,
            lookup_email
        )

        if gaveur:
            # GAVEUR TROUVÉ - Vérifier mot de passe
            if gaveur['password_hash']:
                if not verify_password(credentials.password, gaveur['password_hash']):
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="Identifiants invalides"
                    )
            else:
                # Migration: accepter gaveur123 et hasher
                if credentials.password != "gaveur123":
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="Identifiants invalides"
                    )
                hashed = hash_password(credentials.password)
                await conn.execute(
                    "UPDATE gaveurs SET password_hash = $1 WHERE id = $2",
                    hashed, gaveur['id']
                )

            # Créer tokens pour GAVEUR
            token_pair = create_token_pair({
                "user_id": gaveur['id'],
                "email": gaveur['email'],
                "role": "gaveur",
                "user_type": "gaveur",
            })

            return LoginResponse(
                access_token=token_pair.access_token,
                refresh_token=token_pair.refresh_token,
                token_type=token_pair.token_type,
                expires_in=token_pair.expires_in,
                user_info={
                    "id": gaveur['id'],
                    "email": gaveur['email'],
                    "nom": gaveur['nom'],
                    "prenom": gaveur['prenom'],
                    "name": f"{gaveur['prenom']} {gaveur['nom']}",
                    "role": "gaveur",
                    "user_type": "gaveur",
                    "site": gaveur['site_origine']
                }
            )

    # ========================================================================
    # ÉTAPE 2: Chercher dans les SUPERVISEURS (hardcodé temporaire)
    # ========================================================================
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

    user_data = superviseurs.get(lookup_email)

    if user_data:
        # SUPERVISEUR TROUVÉ - Vérifier mot de passe
        if credentials.password != user_data["password"]:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Identifiants invalides"
            )

        # Créer tokens pour SUPERVISEUR
        token_pair = create_token_pair({
            "user_id": user_data["id"],
            "email": lookup_email,
            "role": user_data["role"],
            "user_type": "supervisor",
            "sites": user_data["sites"]
        })

        return LoginResponse(
            access_token=token_pair.access_token,
            refresh_token=token_pair.refresh_token,
            token_type=token_pair.token_type,
            expires_in=token_pair.expires_in,
            user_info={
                "id": user_data["id"],
                "email": lookup_email,
                "nom": user_data["nom"],
                "prenom": user_data["prenom"],
                "role": user_data["role"],
                "user_type": "supervisor",
                "sites": user_data["sites"]
            }
        )

    # ========================================================================
    # AUCUN UTILISATEUR TROUVÉ
    # ========================================================================
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Identifiants invalides"
    )


@router.get("/me", response_model=UserInfoResponse)
async def get_current_supervisor_info(
    current_supervisor: TokenData = Depends(get_current_supervisor)
):
    """
    Récupérer informations du superviseur connecté

    Requiert: Token JWT valide de type supervisor
    """
    # TEMPORAIRE: Données en dur (à remplacer par requête DB)
    superviseurs = {
        1: {
            "email": "superviseur@euralis.fr",
            "nom": "Dupont",
            "prenom": "Marie",
            "role": "superviseur",
            "sites": ["LL", "LS", "MT"]
        },
        2: {
            "email": "admin@euralis.fr",
            "nom": "Martin",
            "prenom": "Jean",
            "role": "admin",
            "sites": ["LL", "LS", "MT"]
        }
    }

    user_data = superviseurs.get(current_supervisor.user_id)

    if not user_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Superviseur non trouvé"
        )

    return UserInfoResponse(
        id=current_supervisor.user_id,
        email=current_supervisor.email,
        nom=user_data["nom"],
        prenom=user_data["prenom"],
        role=user_data["role"],
        user_type="supervisor",
        sites=user_data["sites"]
    )


# =============================================================================
# REFRESH TOKEN
# =============================================================================

@router.post("/refresh", response_model=TokenPair)
async def refresh_access_token(request_data: RefreshRequest, request: Request):
    """
    Rafraîchir l'access token avec un refresh token

    Le refresh token est valide 7 jours, l'access token 1 heure.
    Permet de renouveler l'access token sans redemander les credentials.

    Args:
        refresh_token: Refresh token valide

    Returns:
        TokenPair: Nouvelle paire de tokens
    """
    # Décoder le refresh token
    payload = decode_refresh_token(request_data.refresh_token)

    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token invalide ou expiré"
        )

    # TODO: Vérifier que le refresh token n'a pas été révoqué
    # (nécessite une table refresh_tokens en base de données)

    user_id = payload.get("user_id")
    email = payload.get("email")
    user_type = payload.get("user_type")

    if not user_id or not email or not user_type:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token invalide"
        )

    # Récupérer les informations utilisateur mises à jour
    pool = request.app.state.db_pool

    if user_type == "gaveur":
        async with pool.acquire() as conn:
            gaveur = await conn.fetchrow(
                "SELECT id, email FROM gaveurs WHERE id = $1",
                user_id
            )
            if not gaveur:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Utilisateur non trouvé"
                )

        # Créer nouveaux tokens
        token_pair = create_token_pair({
            "user_id": user_id,
            "email": email,
            "role": "gaveur",
            "user_type": "gaveur",
        })

    elif user_type == "supervisor":
        # TEMPORAIRE: Vérifier dans la liste en dur
        superviseurs = {1, 2}
        if user_id not in superviseurs:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Utilisateur non trouvé"
            )

        # Créer nouveaux tokens
        token_pair = create_token_pair({
            "user_id": user_id,
            "email": email,
            "role": "superviseur" if user_id == 1 else "admin",
            "user_type": "supervisor",
        })

    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Type d'utilisateur invalide"
        )

    return token_pair


# =============================================================================
# LOGOUT
# =============================================================================

@router.post("/logout")
async def logout(request_data: LogoutRequest):
    """
    Déconnexion (révocation du refresh token)

    TODO: Implémenter la révocation en base de données
    Pour l'instant, le client doit simplement supprimer les tokens

    Args:
        refresh_token: Refresh token à révoquer
    """
    # TODO: Ajouter le JTI du refresh token dans une table de révocation
    # avec expiration automatique après REFRESH_TOKEN_EXPIRE_DAYS

    # Pour l'instant, retourner succès
    # Le client supprimera les tokens de son côté
    return {
        "success": True,
        "message": "Déconnecté avec succès"
    }


# =============================================================================
# ROUTES PROTÉGÉES (EXEMPLES)
# =============================================================================

@router.get("/protected/user")
async def protected_route_user(current_user: TokenData = Depends(get_current_user)):
    """
    Route protégée accessible à tous les utilisateurs authentifiés

    Exemple d'utilisation de get_current_user
    """
    return {
        "message": "Accès autorisé",
        "user_id": current_user.user_id,
        "email": current_user.email,
        "user_type": current_user.user_type
    }


@router.get("/protected/gaveur")
async def protected_route_gaveur(gaveur: TokenData = Depends(get_current_gaveur)):
    """
    Route protégée accessible uniquement aux gaveurs

    Exemple d'utilisation de get_current_gaveur
    """
    return {
        "message": "Accès gaveur autorisé",
        "gaveur_id": gaveur.user_id
    }


@router.get("/protected/supervisor")
async def protected_route_supervisor(
    supervisor: TokenData = Depends(get_current_supervisor)
):
    """
    Route protégée accessible uniquement aux superviseurs

    Exemple d'utilisation de get_current_supervisor
    """
    return {
        "message": "Accès superviseur autorisé",
        "supervisor_id": supervisor.user_id
    }
