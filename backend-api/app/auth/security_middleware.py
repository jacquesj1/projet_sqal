"""
Security Middleware for Automatic Token Validation

This middleware provides:
- Automatic JWT validation for all requests (except public routes)
- Request ID generation for tracing
- Security headers (HSTS, CSP, X-Frame-Options)
- Rate limiting integration
- Audit logging for all authenticated requests
"""

from fastapi import Request, HTTPException, status
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response
from typing import List, Callable
import logging
import uuid
import time

from app.auth.keycloak import get_current_user, oauth2_scheme, _log_auth_event

logger = logging.getLogger(__name__)
audit_logger = logging.getLogger("audit")


# Public routes that don't require authentication
PUBLIC_ROUTES = [
    "/",
    "/health",
    "/health/startup",
    "/health/live",
    "/health/ready",
    "/metrics",
    "/docs",
    "/openapi.json",
    "/redoc",
    "/api/auth/login",
    "/api/auth/refresh",
    "/api/auth/health",
    "/api/consumer/feedback",  # Public consumer feedback endpoint
    "/api/consumer/products",  # Public product listing
]


def is_public_route(path: str) -> bool:
    """
    Check if route is public (doesn't require authentication)
    """
    # Exact match
    if path in PUBLIC_ROUTES:
        return True

    # Prefix match for wildcards
    for public_route in PUBLIC_ROUTES:
        if public_route.endswith("*") and path.startswith(public_route[:-1]):
            return True

    return False


class SecurityMiddleware(BaseHTTPMiddleware):
    """
    Security middleware for automatic JWT validation and security headers
    """

    def __init__(self, app, enforce_auth: bool = True):
        super().__init__(app)
        self.enforce_auth = enforce_auth

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Generate unique request ID for tracing
        request_id = str(uuid.uuid4())
        request.state.request_id = request_id

        # Start timing
        start_time = time.time()

        # Extract path
        path = request.url.path

        # Skip auth for public routes
        if is_public_route(path):
            response = await call_next(request)
            self._add_security_headers(response)
            return response

        # Extract token from Authorization header
        auth_header = request.headers.get("Authorization")
        token = None

        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]

        # Validate token if authentication is enforced
        if self.enforce_auth:
            if not token:
                audit_logger.warning(
                    f"UNAUTHORIZED_ACCESS | path={path} | ip={request.client.host} | "
                    f"request_id={request_id} | reason=missing_token"
                )
                return Response(
                    content='{"detail":"Authentication required"}',
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    media_type="application/json",
                    headers={"WWW-Authenticate": "Bearer"}
                )

            # Validate token (this will raise HTTPException if invalid)
            try:
                # Import here to avoid circular dependency
                from app.auth.keycloak import keycloak_openid, _verify_token_claims, _extract_custom_attributes
                from jose import jwt, JWTError

                # Get public key
                KEYCLOAK_PUBLIC_KEY = f"-----BEGIN PUBLIC KEY-----\n{keycloak_openid.public_key()}\n-----END PUBLIC KEY-----"

                # Decode token
                payload = jwt.decode(
                    token,
                    KEYCLOAK_PUBLIC_KEY,
                    algorithms=["RS256"],
                    options={"verify_aud": False}
                )

                # Verify claims
                _verify_token_claims(payload)

                username = payload.get("preferred_username")

                # Store user info in request state
                request.state.user = {
                    "username": username,
                    "email": payload.get("email"),
                    "realm_roles": payload.get("realm_access", {}).get("roles", []),
                    "attributes": _extract_custom_attributes(payload),
                    "sub": payload.get("sub")
                }

                # Log authenticated request
                audit_logger.info(
                    f"AUTHENTICATED_REQUEST | path={path} | user={username} | "
                    f"method={request.method} | ip={request.client.host} | "
                    f"request_id={request_id}"
                )

            except Exception as e:
                logger.error(f"Token validation failed: {e}")
                audit_logger.warning(
                    f"UNAUTHORIZED_ACCESS | path={path} | ip={request.client.host} | "
                    f"request_id={request_id} | reason=invalid_token | error={str(e)}"
                )
                return Response(
                    content='{"detail":"Invalid or expired token"}',
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    media_type="application/json",
                    headers={"WWW-Authenticate": "Bearer"}
                )

        # Process request
        response = await call_next(request)

        # Add security headers
        self._add_security_headers(response)

        # Add request ID to response
        response.headers["X-Request-ID"] = request_id

        # Log response
        duration = time.time() - start_time
        logger.debug(
            f"REQUEST_COMPLETED | path={path} | method={request.method} | "
            f"status={response.status_code} | duration={duration:.3f}s | "
            f"request_id={request_id}"
        )

        return response

    def _add_security_headers(self, response: Response):
        """
        Add security headers to response
        """
        # HSTS (HTTP Strict Transport Security)
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"

        # Prevent clickjacking
        response.headers["X-Frame-Options"] = "DENY"

        # Prevent MIME type sniffing
        response.headers["X-Content-Type-Options"] = "nosniff"

        # XSS Protection
        response.headers["X-XSS-Protection"] = "1; mode=block"

        # Content Security Policy (basic - adjust for your needs)
        response.headers["Content-Security-Policy"] = "default-src 'self'; frame-ancestors 'none';"

        # Referrer Policy
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

        # Permissions Policy (Feature Policy)
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"


class AuditLoggingMiddleware(BaseHTTPMiddleware):
    """
    Middleware for comprehensive audit logging

    Logs all data mutations (POST, PUT, PATCH, DELETE)
    """

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Only log mutations
        if request.method in ["POST", "PUT", "PATCH", "DELETE"]:
            user = getattr(request.state, "user", None)
            username = user.get("username") if user else "anonymous"

            audit_logger.info(
                f"DATA_MUTATION | method={request.method} | path={request.url.path} | "
                f"user={username} | ip={request.client.host} | "
                f"request_id={getattr(request.state, 'request_id', 'unknown')}"
            )

        response = await call_next(request)
        return response
