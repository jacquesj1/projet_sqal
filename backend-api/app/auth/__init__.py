"""
Authentication Module
=====================

Module d'authentification JWT pour le système Euralis Gaveurs.

Exports:
    - jwt_handler: Fonctions de génération/validation de tokens JWT
    - dependencies: Dépendances FastAPI pour protéger les routes
"""

from .jwt_handler import (
    create_access_token,
    create_refresh_token,
    create_token_pair,
    decode_access_token,
    decode_refresh_token,
    hash_password,
    verify_password,
    is_token_expired,
    get_token_expiry,
    TokenData,
    TokenPair,
    ACCESS_TOKEN_EXPIRE_MINUTES,
    REFRESH_TOKEN_EXPIRE_DAYS,
)

from .dependencies import (
    get_current_user,
    get_current_gaveur,
    get_current_supervisor,
    get_current_admin,
    get_optional_user,
)

__all__ = [
    # JWT Handler
    "create_access_token",
    "create_refresh_token",
    "create_token_pair",
    "decode_access_token",
    "decode_refresh_token",
    "hash_password",
    "verify_password",
    "is_token_expired",
    "get_token_expiry",
    "TokenData",
    "TokenPair",
    "ACCESS_TOKEN_EXPIRE_MINUTES",
    "REFRESH_TOKEN_EXPIRE_DAYS",
    # Dependencies
    "get_current_user",
    "get_current_gaveur",
    "get_current_supervisor",
    "get_current_admin",
    "get_optional_user",
]
