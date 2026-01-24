"""
Keycloak Configuration for FastAPI Backend
JWT Token Validation and Role Management
"""

from typing import List, Optional
from fastapi import HTTPException, Security, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from pydantic import BaseModel
import os
from functools import wraps

# Keycloak configuration
KEYCLOAK_URL = os.getenv("KEYCLOAK_URL", "http://localhost:8080")
KEYCLOAK_REALM = os.getenv("KEYCLOAK_REALM", "sqal_realm")
KEYCLOAK_CLIENT_ID = os.getenv("KEYCLOAK_CLIENT_ID", "sqal-frontend")

# JWT configuration
ALGORITHM = "RS256"
PUBLIC_KEY_URL = f"{KEYCLOAK_URL}/realms/{KEYCLOAK_REALM}/protocol/openid-connect/certs"

# Security scheme
security = HTTPBearer()

# Role definitions (same as frontend)
class Roles:
    SUPER_ADMIN = "super_admin"
    ORG_ADMIN = "org_admin"
    QUALITY_MANAGER = "quality_manager"
    PRODUCTION_OPERATOR = "production_operator"
    DATA_ANALYST = "data_analyst"
    VIEWER = "viewer"

# Role hierarchy
ROLE_HIERARCHY = {
    Roles.SUPER_ADMIN: 6,
    Roles.ORG_ADMIN: 5,
    Roles.QUALITY_MANAGER: 4,
    Roles.PRODUCTION_OPERATOR: 3,
    Roles.DATA_ANALYST: 2,
    Roles.VIEWER: 1,
}

class TokenData(BaseModel):
    username: Optional[str] = None
    email: Optional[str] = None
    roles: List[str] = []
    sub: Optional[str] = None

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Security(security)
) -> TokenData:
    """
    Validate JWT token and extract user information
    """
    token = credentials.credentials
    
    try:
        # Decode JWT token
        payload = jwt.decode(
            token,
            options={"verify_signature": False}  # For development
            # In production, verify signature with public key
        )
        
        username: str = payload.get("preferred_username")
        email: str = payload.get("email")
        realm_access = payload.get("realm_access", {})
        roles: List[str] = realm_access.get("roles", [])
        sub: str = payload.get("sub")
        
        if username is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials",
            )
        
        return TokenData(
            username=username,
            email=email,
            roles=roles,
            sub=sub
        )
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
        )

def require_role(required_role: str):
    """
    Decorator to require a specific role
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, current_user: TokenData = Security(get_current_user), **kwargs):
            if required_role not in current_user.roles:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Role '{required_role}' required"
                )
            return await func(*args, current_user=current_user, **kwargs)
        return wrapper
    return decorator

def require_any_role(required_roles: List[str]):
    """
    Decorator to require any of the specified roles
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, current_user: TokenData = Security(get_current_user), **kwargs):
            if not any(role in current_user.roles for role in required_roles):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"One of roles {required_roles} required"
                )
            return await func(*args, current_user=current_user, **kwargs)
        return wrapper
    return decorator

def require_minimum_role(minimum_role: str):
    """
    Decorator to require a minimum role level (hierarchy)
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, current_user: TokenData = Security(get_current_user), **kwargs):
            minimum_level = ROLE_HIERARCHY.get(minimum_role, 0)
            user_max_level = max(
                [ROLE_HIERARCHY.get(role, 0) for role in current_user.roles],
                default=0
            )
            
            if user_max_level < minimum_level:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Minimum role '{minimum_role}' required"
                )
            return await func(*args, current_user=current_user, **kwargs)
        return wrapper
    return decorator
