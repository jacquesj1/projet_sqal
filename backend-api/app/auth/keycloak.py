"""
Keycloak Authentication & Authorization with Enhanced Security

This module provides:
- JWT token validation with comprehensive claims verification
- Role-Based Access Control (RBAC) for realm and client roles
- Custom user attributes extraction (gaveur_id, site_id)
- Audit logging for all authentication events
- Token expiration, signature, and issuer verification
"""

from fastapi import Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer
from keycloak import KeycloakOpenID
from jose import jwt, JWTError
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
import os

# Use centralized logging configuration
try:
    from app.core.logging_config import get_logger
    logger = get_logger("auth")
    audit_logger = get_logger("audit")
except ImportError:
    import logging
    logger = logging.getLogger(__name__)
    audit_logger = logging.getLogger("audit")

# Keycloak Configuration
KEYCLOAK_URL = os.getenv("KEYCLOAK_URL", "http://localhost:8080")
KEYCLOAK_REALM = os.getenv("KEYCLOAK_REALM", "gaveurs-production")
KEYCLOAK_CLIENT_ID = os.getenv("KEYCLOAK_CLIENT_ID", "backend-api")
KEYCLOAK_CLIENT_SECRET = os.getenv("KEYCLOAK_CLIENT_SECRET", "")

# Security Configuration
VERIFY_TOKEN_EXPIRATION = os.getenv("VERIFY_TOKEN_EXPIRATION", "true").lower() == "true"
VERIFY_TOKEN_SIGNATURE = os.getenv("VERIFY_TOKEN_SIGNATURE", "true").lower() == "true"
VERIFY_TOKEN_ISSUER = os.getenv("VERIFY_TOKEN_ISSUER", "true").lower() == "true"
EXPECTED_ISSUER = f"{KEYCLOAK_URL}/realms/{KEYCLOAK_REALM}"

# OAuth2 scheme
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login", auto_error=False)

# Keycloak OpenID Connect Client
keycloak_openid = KeycloakOpenID(
    server_url=KEYCLOAK_URL,
    client_id=KEYCLOAK_CLIENT_ID,
    realm_name=KEYCLOAK_REALM,
    client_secret_key=KEYCLOAK_CLIENT_SECRET
)


def _log_auth_event(event_type: str, username: Optional[str], success: bool, details: str = ""):
    """
    Log authentication events for security audit
    """
    audit_logger.info(
        f"AUTH_EVENT | type={event_type} | user={username or 'unknown'} | "
        f"success={success} | timestamp={datetime.now(timezone.utc).isoformat()} | "
        f"details={details}"
    )


def _verify_token_claims(payload: Dict[str, Any]) -> None:
    """
    Verify JWT claims for security:
    - exp: Token expiration time
    - iat: Issued at time
    - nbf: Not before time
    - iss: Issuer verification
    """
    current_time = datetime.now(timezone.utc).timestamp()

    # Verify expiration
    if VERIFY_TOKEN_EXPIRATION:
        exp = payload.get("exp")
        if not exp:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token missing expiration claim (exp)"
            )
        if current_time > exp:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token has expired"
            )

    # Verify not before
    nbf = payload.get("nbf")
    if nbf and current_time < nbf:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token not yet valid (nbf)"
        )

    # Verify issuer
    if VERIFY_TOKEN_ISSUER:
        iss = payload.get("iss")
        if not iss:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token missing issuer claim (iss)"
            )
        if iss != EXPECTED_ISSUER:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Invalid token issuer. Expected: {EXPECTED_ISSUER}, Got: {iss}"
            )


def _extract_custom_attributes(payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Extract custom user attributes from Keycloak token

    Returns:
        - gaveur_id: Integer ID for gaveur users
        - site_id: Site identifier (LL, LS, MO)
        - organization: Organization name
    """
    attributes = {}

    # Extract from custom claims (if set in Keycloak user attributes)
    if "gaveur_id" in payload:
        try:
            attributes["gaveur_id"] = int(payload["gaveur_id"])
        except (ValueError, TypeError):
            logger.warning(f"Invalid gaveur_id in token: {payload.get('gaveur_id')}")

    if "site_id" in payload:
        attributes["site_id"] = payload["site_id"]

    if "organization" in payload:
        attributes["organization"] = payload["organization"]

    return attributes


async def get_current_user(token: Optional[str] = Depends(oauth2_scheme)) -> Optional[Dict]:
    """
    Validate JWT token and return user information

    Returns None if no token provided (allows public routes)

    Token validation includes:
    - Signature verification (RS256)
    - Expiration check (exp claim)
    - Not-before check (nbf claim)
    - Issuer verification (iss claim)
    - Custom claims extraction

    Returns:
        User info dict with:
        - username, email, name
        - realm_roles: List of realm-level roles
        - client_roles: Dict of client-specific roles
        - gaveur_id, site_id (if available)
    """
    if not token:
        return None

    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        # Get public key from Keycloak
        KEYCLOAK_PUBLIC_KEY = f"-----BEGIN PUBLIC KEY-----\n{keycloak_openid.public_key()}\n-----END PUBLIC KEY-----"

        # Decode and validate token signature
        decode_options = {
            "verify_signature": VERIFY_TOKEN_SIGNATURE,
            "verify_aud": False,  # Keycloak tokens may not have aud claim
            "verify_exp": VERIFY_TOKEN_EXPIRATION,
        }

        payload = jwt.decode(
            token,
            KEYCLOAK_PUBLIC_KEY,
            algorithms=["RS256"],
            options=decode_options
        )

        # Verify additional claims
        _verify_token_claims(payload)

        username: str = payload.get("preferred_username")
        if username is None:
            _log_auth_event("TOKEN_VALIDATION", None, False, "Missing preferred_username claim")
            raise credentials_exception

        # Extract user info
        user_info = {
            "username": username,
            "email": payload.get("email"),
            "name": payload.get("name"),
            "given_name": payload.get("given_name"),
            "family_name": payload.get("family_name"),
            "realm_roles": payload.get("realm_access", {}).get("roles", []),
            "client_roles": {},
            "sub": payload.get("sub"),
            "exp": payload.get("exp"),
            "iat": payload.get("iat"),
            "attributes": _extract_custom_attributes(payload)
        }

        # Extract client roles for all clients
        resource_access = payload.get("resource_access", {})
        for client, access in resource_access.items():
            user_info["client_roles"][client] = access.get("roles", [])

        # Log successful validation
        _log_auth_event("TOKEN_VALIDATION", username, True, f"Roles: {user_info['realm_roles']}")

        return user_info

    except HTTPException:
        # Re-raise HTTP exceptions (already formatted)
        raise
    except JWTError as e:
        logger.error(f"JWT validation error: {e}")
        _log_auth_event("TOKEN_VALIDATION", None, False, f"JWT error: {str(e)}")
        raise credentials_exception
    except Exception as e:
        logger.error(f"Token validation error: {e}")
        _log_auth_event("TOKEN_VALIDATION", None, False, f"Unexpected error: {str(e)}")
        raise credentials_exception


def require_authentication():
    """
    Dependency qui requiert que l'utilisateur soit authentifié
    """
    async def check_auth(current_user = Depends(get_current_user)):
        if current_user is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required"
            )
        return current_user
    return check_auth


def require_role(required_role: str):
    """
    Decorator pour vérifier qu'un utilisateur a un rôle realm spécifique
    """
    async def role_checker(current_user = Depends(get_current_user)):
        if current_user is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required"
            )

        if required_role not in current_user["realm_roles"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{required_role}' required"
            )
        return current_user
    return role_checker


def require_any_role(required_roles: List[str]):
    """
    Decorator pour vérifier qu'un utilisateur a AU MOINS UN des rôles
    """
    async def role_checker(current_user = Depends(get_current_user)):
        if current_user is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required"
            )

        user_roles = current_user["realm_roles"]
        if not any(role in user_roles for role in required_roles):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"One of these roles required: {', '.join(required_roles)}"
            )
        return current_user
    return role_checker


def require_client_role(client_id: str, required_role: str):
    """
    Decorator pour vérifier qu'un utilisateur a un rôle client spécifique
    """
    async def role_checker(current_user = Depends(get_current_user)):
        if current_user is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required"
            )

        client_roles = current_user["client_roles"].get(client_id, [])
        if required_role not in client_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Client role '{client_id}:{required_role}' required"
            )
        return current_user
    return role_checker


def get_user_gaveur_id(current_user: Dict) -> Optional[int]:
    """
    Extract gaveur_id from Keycloak user attributes

    This ID is used for data isolation - ensures gaveurs can only
    access their own data.
    """
    if not current_user:
        return None

    return current_user.get("attributes", {}).get("gaveur_id")


def get_user_site_id(current_user: Dict) -> Optional[str]:
    """
    Extract site_id from Keycloak user attributes

    Returns site identifier (e.g., "LL", "LS", "MO")
    """
    if not current_user:
        return None

    return current_user.get("attributes", {}).get("site_id")


def has_permission(current_user: Dict, resource: str, action: str) -> bool:
    """
    Check if user has permission to perform action on resource

    Examples:
        has_permission(user, "gavage_data", "read")
        has_permission(user, "analytics", "export")

    Permission logic:
        - admin role: full access to everything
        - superviseur: read access to all sites, write to assigned sites
        - gaveur: read/write to own data only
        - technicien_sqal: read/write SQAL data
    """
    if not current_user:
        return False

    realm_roles = current_user.get("realm_roles", [])

    # Admin has full access
    if "admin" in realm_roles:
        return True

    # Resource-specific permissions
    if resource == "gavage_data":
        if action == "read":
            return "gaveur" in realm_roles or "superviseur" in realm_roles or "admin" in realm_roles
        elif action == "write":
            return "gaveur" in realm_roles or "admin" in realm_roles

    elif resource == "analytics":
        if action == "read":
            return "superviseur" in realm_roles or "admin" in realm_roles
        elif action == "export":
            # Check for client role
            client_roles = current_user.get("client_roles", {}).get("euralis-frontend", [])
            return "export_reports" in client_roles or "admin" in realm_roles

    elif resource == "sqal_data":
        if "technicien_sqal" in realm_roles or "admin" in realm_roles:
            return True

    elif resource == "multi_site":
        return "superviseur" in realm_roles or "admin" in realm_roles

    return False


async def get_current_user_required(current_user: Optional[Dict] = Depends(get_current_user)) -> Dict:
    """
    Dependency that requires authentication

    Use this instead of get_current_user when route MUST be protected
    """
    if current_user is None:
        _log_auth_event("AUTH_REQUIRED", None, False, "No token provided")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return current_user
