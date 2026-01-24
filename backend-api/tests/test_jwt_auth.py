"""
Tests pour le système JWT Authentication
==========================================

Tests unitaires pour vérifier:
- Génération et validation de tokens
- Password hashing
- Endpoints d'authentification
- Protection des routes
"""

import pytest
from app.auth import (
    create_access_token,
    create_refresh_token,
    create_token_pair,
    decode_access_token,
    decode_refresh_token,
    hash_password,
    verify_password,
    is_token_expired,
    get_token_expiry,
)


# =============================================================================
# TESTS PASSWORD HASHING
# =============================================================================

def test_hash_password():
    """Test que hash_password génère un hash bcrypt valide"""
    password = "my_secure_password_123"
    hashed = hash_password(password)

    # Vérifier que le hash est différent du mot de passe
    assert hashed != password

    # Vérifier que le hash commence par $2b$ (bcrypt)
    assert hashed.startswith("$2b$")

    # Vérifier la longueur du hash (60 caractères pour bcrypt)
    assert len(hashed) == 60


def test_verify_password_correct():
    """Test que verify_password accepte le bon mot de passe"""
    password = "correct_password"
    hashed = hash_password(password)

    assert verify_password(password, hashed) is True


def test_verify_password_incorrect():
    """Test que verify_password rejette un mauvais mot de passe"""
    password = "correct_password"
    wrong_password = "wrong_password"
    hashed = hash_password(password)

    assert verify_password(wrong_password, hashed) is False


def test_hash_password_different_salts():
    """Test que deux hashs du même mot de passe sont différents (salt)"""
    password = "same_password"
    hash1 = hash_password(password)
    hash2 = hash_password(password)

    # Les hashs doivent être différents (salt aléatoire)
    assert hash1 != hash2

    # Mais les deux doivent valider le même mot de passe
    assert verify_password(password, hash1) is True
    assert verify_password(password, hash2) is True


# =============================================================================
# TESTS JWT TOKEN GENERATION
# =============================================================================

def test_create_access_token():
    """Test la création d'un access token"""
    user_data = {
        "user_id": 1,
        "email": "test@example.com",
        "role": "supervisor",
        "user_type": "supervisor",
    }

    token = create_access_token(user_data)

    # Vérifier que le token est une string non vide
    assert isinstance(token, str)
    assert len(token) > 0

    # Vérifier que le token est au format JWT (3 parties séparées par .)
    parts = token.split(".")
    assert len(parts) == 3


def test_create_refresh_token():
    """Test la création d'un refresh token"""
    user_data = {
        "user_id": 1,
        "email": "test@example.com",
        "user_type": "supervisor",
    }

    token = create_refresh_token(user_data)

    # Vérifier que le token est une string non vide
    assert isinstance(token, str)
    assert len(token) > 0

    # Vérifier que le token est au format JWT
    parts = token.split(".")
    assert len(parts) == 3


def test_create_token_pair():
    """Test la création d'une paire de tokens"""
    user_data = {
        "user_id": 1,
        "email": "test@example.com",
        "role": "admin",
        "user_type": "supervisor",
    }

    token_pair = create_token_pair(user_data)

    # Vérifier que la paire contient access_token et refresh_token
    assert hasattr(token_pair, "access_token")
    assert hasattr(token_pair, "refresh_token")
    assert hasattr(token_pair, "token_type")
    assert hasattr(token_pair, "expires_in")

    # Vérifier que le token_type est Bearer
    assert token_pair.token_type == "Bearer"

    # Vérifier que expires_in est positif
    assert token_pair.expires_in > 0

    # Vérifier que les tokens sont différents
    assert token_pair.access_token != token_pair.refresh_token


# =============================================================================
# TESTS JWT TOKEN VALIDATION
# =============================================================================

def test_decode_access_token():
    """Test le décodage d'un access token valide"""
    user_data = {
        "user_id": 42,
        "email": "supervisor@euralis.fr",
        "role": "supervisor",
        "user_type": "supervisor",
    }

    token = create_access_token(user_data)
    decoded = decode_access_token(token)

    # Vérifier que le décodage a réussi
    assert decoded is not None

    # Vérifier que les données sont correctes
    assert decoded.user_id == 42
    assert decoded.email == "supervisor@euralis.fr"
    assert decoded.role == "supervisor"
    assert decoded.user_type == "supervisor"

    # Vérifier que l'expiration est définie
    assert decoded.exp is not None


def test_decode_access_token_invalid():
    """Test le décodage d'un token invalide"""
    invalid_token = "invalid.token.here"

    decoded = decode_access_token(invalid_token)

    # Vérifier que le décodage échoue
    assert decoded is None


def test_decode_refresh_token():
    """Test le décodage d'un refresh token valide"""
    user_data = {
        "user_id": 10,
        "email": "gaveur@example.com",
        "user_type": "gaveur",
    }

    token = create_refresh_token(user_data)
    payload = decode_refresh_token(token)

    # Vérifier que le décodage a réussi
    assert payload is not None

    # Vérifier que les données sont correctes
    assert payload["user_id"] == 10
    assert payload["email"] == "gaveur@example.com"
    assert payload["user_type"] == "gaveur"

    # Vérifier la présence du JTI (unique ID)
    assert "jti" in payload

    # Vérifier le type de token
    assert payload["type"] == "refresh"


def test_decode_access_token_as_refresh():
    """Test qu'un access token ne peut pas être décodé comme refresh token"""
    user_data = {
        "user_id": 1,
        "email": "test@example.com",
        "role": "user",
        "user_type": "gaveur",
    }

    access_token = create_access_token(user_data)

    # Tenter de décoder un access token comme refresh token
    payload = decode_refresh_token(access_token)

    # Doit échouer (type incorrect)
    assert payload is None


def test_decode_refresh_token_as_access():
    """Test qu'un refresh token ne peut pas être décodé comme access token"""
    user_data = {
        "user_id": 1,
        "email": "test@example.com",
        "user_type": "gaveur",
    }

    refresh_token = create_refresh_token(user_data)

    # Tenter de décoder un refresh token comme access token
    token_data = decode_access_token(refresh_token)

    # Doit échouer (type incorrect)
    assert token_data is None


# =============================================================================
# TESTS EXPIRATION
# =============================================================================

def test_is_token_expired():
    """Test la vérification d'expiration d'un token"""
    user_data = {
        "user_id": 1,
        "email": "test@example.com",
        "role": "user",
        "user_type": "gaveur",
    }

    # Créer un token non expiré
    token = create_access_token(user_data)
    token_data = decode_access_token(token)

    # Vérifier que le token n'est pas expiré
    assert is_token_expired(token_data) is False


def test_get_token_expiry():
    """Test la récupération du temps avant expiration"""
    user_data = {
        "user_id": 1,
        "email": "test@example.com",
        "role": "user",
        "user_type": "gaveur",
    }

    token = create_access_token(user_data)
    token_data = decode_access_token(token)

    # Récupérer le temps avant expiration
    expiry_seconds = get_token_expiry(token_data)

    # Vérifier que l'expiration est positive et raisonnable
    # (devrait être environ 3600 secondes = 1 heure)
    assert expiry_seconds is not None
    assert expiry_seconds > 0
    assert expiry_seconds <= 3600  # Max 1 heure


# =============================================================================
# TESTS ENDPOINTS (NÉCESSITE SERVEUR)
# =============================================================================

# NOTE: Les tests ci-dessous nécessitent que le serveur FastAPI soit lancé
# Ils peuvent être skippés si le serveur n'est pas disponible

@pytest.mark.skip(reason="Requires running server")
def test_login_endpoint():
    """Test l'endpoint de login (nécessite serveur)"""
    import httpx

    response = httpx.post(
        "http://localhost:8000/api/auth/login",
        json={
            "email": "superviseur@euralis.fr",
            "password": "super123"
        }
    )

    assert response.status_code == 200
    data = response.json()

    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "Bearer"


@pytest.mark.skip(reason="Requires running server")
def test_refresh_endpoint():
    """Test l'endpoint de refresh (nécessite serveur)"""
    import httpx

    # 1. Login pour obtenir un refresh token
    login_response = httpx.post(
        "http://localhost:8000/api/auth/login",
        json={
            "email": "superviseur@euralis.fr",
            "password": "super123"
        }
    )

    refresh_token = login_response.json()["refresh_token"]

    # 2. Utiliser le refresh token
    refresh_response = httpx.post(
        "http://localhost:8000/api/auth/refresh",
        json={"refresh_token": refresh_token}
    )

    assert refresh_response.status_code == 200
    data = refresh_response.json()

    assert "access_token" in data
    assert "refresh_token" in data


@pytest.mark.skip(reason="Requires running server")
def test_protected_route():
    """Test une route protégée (nécessite serveur)"""
    import httpx

    # 1. Login
    login_response = httpx.post(
        "http://localhost:8000/api/auth/login",
        json={
            "email": "superviseur@euralis.fr",
            "password": "super123"
        }
    )

    access_token = login_response.json()["access_token"]

    # 2. Appeler route protégée
    protected_response = httpx.get(
        "http://localhost:8000/api/auth/protected/supervisor",
        headers={"Authorization": f"Bearer {access_token}"}
    )

    assert protected_response.status_code == 200
    data = protected_response.json()

    assert data["message"] == "Accès superviseur autorisé"


if __name__ == "__main__":
    # Lancer les tests avec pytest
    pytest.main([__file__, "-v"])
