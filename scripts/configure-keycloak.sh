#!/bin/bash
# ==============================================================================
# Script de Configuration Automatique Keycloak - Système Gaveurs V3.0
# ==============================================================================
# Configure automatiquement:
# - Realm: gaveurs-production
# - 4 Clients (backend-api, euralis-frontend, gaveurs-frontend, sqal-frontend)
# - 5 Realm Roles (admin, superviseur, gaveur, technicien_sqal, consommateur)
# - Client Roles pour chaque frontend
# - 5 Users de test avec leurs rôles
# ==============================================================================

set -e  # Exit on error

# ==============================================================================
# Configuration
# ==============================================================================

KEYCLOAK_URL="${KEYCLOAK_URL:-http://localhost:8080}"
ADMIN_USER="${KEYCLOAK_ADMIN:-admin}"
ADMIN_PASSWORD="${KEYCLOAK_ADMIN_PASSWORD:-admin_secure_2024}"
REALM_NAME="gaveurs-production"

# Colors for output
RED='\033[0:31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# ==============================================================================
# Helper Functions
# ==============================================================================

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# ==============================================================================
# Wait for Keycloak to be ready
# ==============================================================================

log_info "Waiting for Keycloak to be ready..."
max_attempts=30
attempt=0

while [ $attempt -lt $max_attempts ]; do
    if curl -s -f "$KEYCLOAK_URL" > /dev/null 2>&1; then
        log_info "Keycloak is ready!"
        break
    fi
    attempt=$((attempt + 1))
    log_warn "Attempt $attempt/$max_attempts - Keycloak not ready yet, waiting..."
    sleep 5
done

if [ $attempt -eq $max_attempts ]; then
    log_error "Keycloak failed to start after $max_attempts attempts"
    exit 1
fi

sleep 5  # Additional wait for services to stabilize

# ==============================================================================
# Get Admin Token
# ==============================================================================

log_info "Getting admin access token..."

TOKEN_RESPONSE=$(curl -s -X POST "$KEYCLOAK_URL/realms/master/protocol/openid-connect/token" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "username=$ADMIN_USER" \
    -d "password=$ADMIN_PASSWORD" \
    -d "grant_type=password" \
    -d "client_id=admin-cli")

ACCESS_TOKEN=$(echo "$TOKEN_RESPONSE" | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)

if [ -z "$ACCESS_TOKEN" ]; then
    log_error "Failed to get access token. Response: $TOKEN_RESPONSE"
    exit 1
fi

log_info "Access token obtained successfully"

# ==============================================================================
# Create Realm
# ==============================================================================

log_info "Creating realm: $REALM_NAME"

curl -s -X POST "$KEYCLOAK_URL/admin/realms" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
        "realm": "'"$REALM_NAME"'",
        "enabled": true,
        "displayName": "Gaveurs Production",
        "registrationAllowed": true,
        "resetPasswordAllowed": true,
        "rememberMe": true,
        "verifyEmail": false,
        "loginWithEmailAllowed": true,
        "duplicateEmailsAllowed": false
    }' || log_warn "Realm may already exist"

log_info "Realm created/verified"

# ==============================================================================
# Create Clients
# ==============================================================================

log_info "Creating clients..."

# Client 1: backend-api (confidential)
log_info "  - backend-api (confidential client)"
curl -s -X POST "$KEYCLOAK_URL/admin/realms/$REALM_NAME/clients" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
        "clientId": "backend-api",
        "name": "Backend API",
        "description": "FastAPI Backend with authentication",
        "enabled": true,
        "protocol": "openid-connect",
        "publicClient": false,
        "directAccessGrantsEnabled": true,
        "standardFlowEnabled": true,
        "serviceAccountsEnabled": true,
        "authorizationServicesEnabled": false,
        "rootUrl": "http://localhost:8000",
        "redirectUris": ["*"],
        "webOrigins": ["*"]
    }' || log_warn "Client backend-api may already exist"

# Client 2: euralis-frontend (public)
log_info "  - euralis-frontend (public client)"
curl -s -X POST "$KEYCLOAK_URL/admin/realms/$REALM_NAME/clients" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
        "clientId": "euralis-frontend",
        "name": "Euralis Dashboard",
        "description": "Multi-site supervision dashboard",
        "enabled": true,
        "protocol": "openid-connect",
        "publicClient": true,
        "directAccessGrantsEnabled": true,
        "standardFlowEnabled": true,
        "rootUrl": "http://localhost:3000",
        "redirectUris": ["http://localhost:3000/*", "http://localhost:3000/auth/callback"],
        "postLogoutRedirectUris": ["http://localhost:3000/*"],
        "webOrigins": ["http://localhost:3000"]
    }' || log_warn "Client euralis-frontend may already exist"

# Client 3: gaveurs-frontend (public)
log_info "  - gaveurs-frontend (public client)"
curl -s -X POST "$KEYCLOAK_URL/admin/realms/$REALM_NAME/clients" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
        "clientId": "gaveurs-frontend",
        "name": "Gaveurs Individual App",
        "description": "Individual gaveur application",
        "enabled": true,
        "protocol": "openid-connect",
        "publicClient": true,
        "directAccessGrantsEnabled": true,
        "standardFlowEnabled": true,
        "rootUrl": "http://localhost:3001",
        "redirectUris": ["http://localhost:3001/*", "http://localhost:3001/auth/callback"],
        "postLogoutRedirectUris": ["http://localhost:3001/*"],
        "webOrigins": ["http://localhost:3001"]
    }' || log_warn "Client gaveurs-frontend may already exist"

# Client 4: sqal-frontend (public)
log_info "  - sqal-frontend (public client)"
curl -s -X POST "$KEYCLOAK_URL/admin/realms/$REALM_NAME/clients" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
        "clientId": "sqal-frontend",
        "name": "SQAL Quality Control",
        "description": "Quality control dashboard with IoT sensors",
        "enabled": true,
        "protocol": "openid-connect",
        "publicClient": true,
        "directAccessGrantsEnabled": true,
        "standardFlowEnabled": true,
        "rootUrl": "http://localhost:5173",
        "redirectUris": ["http://localhost:5173/*", "http://localhost:5173/auth/callback"],
        "postLogoutRedirectUris": ["http://localhost:5173/*"],
        "webOrigins": ["http://localhost:5173"]
    }' || log_warn "Client sqal-frontend may already exist"

log_info "Clients created/verified"

# ==============================================================================
# Create Realm Roles
# ==============================================================================

log_info "Creating realm roles..."

for role in "admin:Administrateur système - accès total" \
            "superviseur:Superviseur Euralis - multi-sites" \
            "gaveur:Gaveur individuel" \
            "technicien_sqal:Technicien SQAL - contrôle qualité" \
            "consommateur:Consommateur - feedback uniquement"; do
    role_name=$(echo "$role" | cut -d':' -f1)
    role_desc=$(echo "$role" | cut -d':' -f2)

    log_info "  - $role_name"
    curl -s -X POST "$KEYCLOAK_URL/admin/realms/$REALM_NAME/roles" \
        -H "Authorization: Bearer $ACCESS_TOKEN" \
        -H "Content-Type: application/json" \
        -d '{
            "name": "'"$role_name"'",
            "description": "'"$role_desc"'"
        }' || log_warn "Role $role_name may already exist"
done

log_info "Realm roles created/verified"

# ==============================================================================
# Get Client IDs (UUIDs)
# ==============================================================================

log_info "Retrieving client UUIDs..."

CLIENTS_JSON=$(curl -s -X GET "$KEYCLOAK_URL/admin/realms/$REALM_NAME/clients" \
    -H "Authorization: Bearer $ACCESS_TOKEN")

EURALIS_CLIENT_ID=$(echo "$CLIENTS_JSON" | grep -o '"id":"[^"]*","clientId":"euralis-frontend"' | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
GAVEURS_CLIENT_ID=$(echo "$CLIENTS_JSON" | grep -o '"id":"[^"]*","clientId":"gaveurs-frontend"' | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
SQAL_CLIENT_ID=$(echo "$CLIENTS_JSON" | grep -o '"id":"[^"]*","clientId":"sqal-frontend"' | grep -o '"id":"[^"]*"' | cut -d'"' -f4)

log_info "Client UUIDs retrieved"

# ==============================================================================
# Create Client Roles
# ==============================================================================

log_info "Creating client roles..."

# Euralis frontend roles
if [ -n "$EURALIS_CLIENT_ID" ]; then
    log_info "  - euralis-frontend roles"
    for role in "view_all_sites:Voir tous les sites" \
                "manage_gaveurs:Gérer les gaveurs" \
                "view_analytics:Voir les analytics" \
                "export_reports:Exporter rapports" \
                "manage_lots:Gérer les lots"; do
        role_name=$(echo "$role" | cut -d':' -f1)
        role_desc=$(echo "$role" | cut -d':' -f2)

        curl -s -X POST "$KEYCLOAK_URL/admin/realms/$REALM_NAME/clients/$EURALIS_CLIENT_ID/roles" \
            -H "Authorization: Bearer $ACCESS_TOKEN" \
            -H "Content-Type: application/json" \
            -d '{
                "name": "'"$role_name"'",
                "description": "'"$role_desc"'"
            }' || true
    done
fi

# Gaveurs frontend roles
if [ -n "$GAVEURS_CLIENT_ID" ]; then
    log_info "  - gaveurs-frontend roles"
    for role in "manage_own_data:Gérer ses propres données" \
                "view_own_analytics:Voir ses analytics" \
                "use_ai_training:Utiliser training IA" \
                "view_blockchain:Voir blockchain" \
                "submit_feedback:Soumettre feedback"; do
        role_name=$(echo "$role" | cut -d':' -f1)
        role_desc=$(echo "$role" | cut -d':' -f2)

        curl -s -X POST "$KEYCLOAK_URL/admin/realms/$REALM_NAME/clients/$GAVEURS_CLIENT_ID/roles" \
            -H "Authorization: Bearer $ACCESS_TOKEN" \
            -H "Content-Type: application/json" \
            -d '{
                "name": "'"$role_name"'",
                "description": "'"$role_desc"'"
            }' || true
    done
fi

# SQAL frontend roles
if [ -n "$SQAL_CLIENT_ID" ]; then
    log_info "  - sqal-frontend roles"
    for role in "view_sensors:Voir capteurs" \
                "manage_quality:Gérer qualité" \
                "export_reports:Exporter rapports" \
                "calibrate_devices:Calibrer dispositifs" \
                "view_realtime:Voir temps réel"; do
        role_name=$(echo "$role" | cut -d':' -f1)
        role_desc=$(echo "$role" | cut -d':' -f2)

        curl -s -X POST "$KEYCLOAK_URL/admin/realms/$REALM_NAME/clients/$SQAL_CLIENT_ID/roles" \
            -H "Authorization: Bearer $ACCESS_TOKEN" \
            -H "Content-Type: application/json" \
            -d '{
                "name": "'"$role_name"'",
                "description": "'"$role_desc"'"
            }' || true
    done
fi

log_info "Client roles created/verified"

# ==============================================================================
# Create Users
# ==============================================================================

log_info "Creating test users..."

# User 1: Admin
log_info "  - admin@euralis.fr"
curl -s -X POST "$KEYCLOAK_URL/admin/realms/$REALM_NAME/users" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
        "username": "admin@euralis.fr",
        "email": "admin@euralis.fr",
        "firstName": "Admin",
        "lastName": "Euralis",
        "enabled": true,
        "emailVerified": true,
        "credentials": [{
            "type": "password",
            "value": "admin123",
            "temporary": false
        }],
        "realmRoles": ["admin"]
    }' || log_warn "User admin@euralis.fr may already exist"

# User 2: Superviseur
log_info "  - superviseur@euralis.fr"
curl -s -X POST "$KEYCLOAK_URL/admin/realms/$REALM_NAME/users" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
        "username": "superviseur@euralis.fr",
        "email": "superviseur@euralis.fr",
        "firstName": "Marie",
        "lastName": "Dupont",
        "enabled": true,
        "emailVerified": true,
        "credentials": [{
            "type": "password",
            "value": "super123",
            "temporary": false
        }],
        "realmRoles": ["superviseur"]
    }' || log_warn "User superviseur@euralis.fr may already exist"

# User 3: Gaveur Jean Martin
log_info "  - jean.martin@gaveur.fr"
curl -s -X POST "$KEYCLOAK_URL/admin/realms/$REALM_NAME/users" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
        "username": "jean.martin@gaveur.fr",
        "email": "jean.martin@gaveur.fr",
        "firstName": "Jean",
        "lastName": "Martin",
        "enabled": true,
        "emailVerified": true,
        "attributes": {
            "gaveur_id": ["1"],
            "site": ["LL"]
        },
        "credentials": [{
            "type": "password",
            "value": "gaveur123",
            "temporary": false
        }],
        "realmRoles": ["gaveur"]
    }' || log_warn "User jean.martin@gaveur.fr may already exist"

# User 4: Gaveur Sophie Dubois
log_info "  - sophie.dubois@gaveur.fr"
curl -s -X POST "$KEYCLOAK_URL/admin/realms/$REALM_NAME/users" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
        "username": "sophie.dubois@gaveur.fr",
        "email": "sophie.dubois@gaveur.fr",
        "firstName": "Sophie",
        "lastName": "Dubois",
        "enabled": true,
        "emailVerified": true,
        "attributes": {
            "gaveur_id": ["2"],
            "site": ["LS"]
        },
        "credentials": [{
            "type": "password",
            "value": "gaveur123",
            "temporary": false
        }],
        "realmRoles": ["gaveur"]
    }' || log_warn "User sophie.dubois@gaveur.fr may already exist"

# User 5: Technicien SQAL
log_info "  - tech@sqal.fr"
curl -s -X POST "$KEYCLOAK_URL/admin/realms/$REALM_NAME/users" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
        "username": "tech@sqal.fr",
        "email": "tech@sqal.fr",
        "firstName": "Technicien",
        "lastName": "SQAL",
        "enabled": true,
        "emailVerified": true,
        "credentials": [{
            "type": "password",
            "value": "sqal123",
            "temporary": false
        }],
        "realmRoles": ["technicien_sqal"]
    }' || log_warn "User tech@sqal.fr may already exist"

log_info "Test users created/verified"

# ==============================================================================
# Get Backend API Client Secret
# ==============================================================================

log_info "Retrieving backend-api client secret..."

BACKEND_CLIENT_ID=$(echo "$CLIENTS_JSON" | grep -o '"id":"[^"]*","clientId":"backend-api"' | grep -o '"id":"[^"]*"' | cut -d'"' -f4)

if [ -n "$BACKEND_CLIENT_ID" ]; then
    CLIENT_SECRET_JSON=$(curl -s -X GET "$KEYCLOAK_URL/admin/realms/$REALM_NAME/clients/$BACKEND_CLIENT_ID/client-secret" \
        -H "Authorization: Bearer $ACCESS_TOKEN")

    CLIENT_SECRET=$(echo "$CLIENT_SECRET_JSON" | grep -o '"value":"[^"]*"' | cut -d'"' -f4)

    if [ -n "$CLIENT_SECRET" ]; then
        log_info "Backend client secret: $CLIENT_SECRET"
        log_info ""
        log_info "Add this to backend-api/.env:"
        echo "KEYCLOAK_CLIENT_SECRET=$CLIENT_SECRET"
    fi
fi

# ==============================================================================
# Summary
# ==============================================================================

echo ""
echo "================================================================================"
log_info "Keycloak Configuration Complete! ✅"
echo "================================================================================"
echo ""
echo "🌐 Keycloak Console: $KEYCLOAK_URL"
echo "🔑 Admin: $ADMIN_USER / $ADMIN_PASSWORD"
echo ""
echo "📋 Test Accounts:"
echo "   ├─ admin@euralis.fr / admin123 (admin - all frontends)"
echo "   ├─ superviseur@euralis.fr / super123 (superviseur - euralis)"
echo "   ├─ jean.martin@gaveur.fr / gaveur123 (gaveur - gaveurs)"
echo "   ├─ sophie.dubois@gaveur.fr / gaveur123 (gaveur - gaveurs)"
echo "   └─ tech@sqal.fr / sqal123 (technicien_sqal - sqal)"
echo ""
echo "🎯 Frontends:"
echo "   ├─ Euralis: http://localhost:3000"
echo "   ├─ Gaveurs: http://localhost:3001"
echo "   └─ SQAL: http://localhost:5173"
echo ""
echo "✅ Realm: $REALM_NAME"
echo "✅ Clients: 4 (backend-api, euralis-frontend, gaveurs-frontend, sqal-frontend)"
echo "✅ Roles: 5 realm roles + client roles"
echo "✅ Users: 5 test accounts"
echo ""
echo "================================================================================"
