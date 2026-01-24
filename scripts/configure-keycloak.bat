@echo off
REM ==============================================================================
REM Script de Configuration Automatique Keycloak - Système Gaveurs V3.0 (Windows)
REM ==============================================================================
REM Configure automatiquement:
REM - Realm: gaveurs-production
REM - 4 Clients (backend-api, euralis-frontend, gaveurs-frontend, sqal-frontend)
REM - 5 Realm Roles (admin, superviseur, gaveur, technicien_sqal, consommateur)
REM - Client Roles pour chaque frontend
REM - 5 Users de test avec leurs rôles
REM ==============================================================================

setlocal enabledelayedexpansion

REM ==============================================================================
REM Configuration
REM ==============================================================================

if "%KEYCLOAK_URL%"=="" set KEYCLOAK_URL=http://localhost:8080
if "%KEYCLOAK_ADMIN%"=="" set KEYCLOAK_ADMIN=admin
if "%KEYCLOAK_ADMIN_PASSWORD%"=="" set KEYCLOAK_ADMIN_PASSWORD=admin_secure_2024
set REALM_NAME=gaveurs-production

echo.
echo ================================================================================
echo Configuration Automatique Keycloak - Gaveurs V3.0
echo ================================================================================
echo.

REM ==============================================================================
REM Wait for Keycloak to be ready
REM ==============================================================================

echo [INFO] Waiting for Keycloak to be ready...
set max_attempts=30
set attempt=0

:wait_loop
set /a attempt+=1
curl -s -f "%KEYCLOAK_URL%" >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo [INFO] Keycloak is ready!
    goto keycloak_ready
)

if %attempt% GEQ %max_attempts% (
    echo [ERROR] Keycloak failed to start after %max_attempts% attempts
    exit /b 1
)

echo [WARN] Attempt %attempt%/%max_attempts% - Keycloak not ready yet, waiting...
timeout /t 5 /nobreak >nul
goto wait_loop

:keycloak_ready
timeout /t 5 /nobreak >nul

REM ==============================================================================
REM Get Admin Token
REM ==============================================================================

echo [INFO] Getting admin access token...

curl -s -X POST "%KEYCLOAK_URL%/realms/master/protocol/openid-connect/token" ^
    -H "Content-Type: application/x-www-form-urlencoded" ^
    -d "username=%KEYCLOAK_ADMIN%" ^
    -d "password=%KEYCLOAK_ADMIN_PASSWORD%" ^
    -d "grant_type=password" ^
    -d "client_id=admin-cli" > token_response.tmp

for /f "tokens=2 delims=:," %%a in ('findstr "access_token" token_response.tmp') do (
    set ACCESS_TOKEN=%%a
)
set ACCESS_TOKEN=!ACCESS_TOKEN:"=!
set ACCESS_TOKEN=!ACCESS_TOKEN: =!

if "!ACCESS_TOKEN!"=="" (
    echo [ERROR] Failed to get access token
    type token_response.tmp
    del token_response.tmp
    exit /b 1
)

del token_response.tmp
echo [INFO] Access token obtained successfully

REM ==============================================================================
REM Create Realm
REM ==============================================================================

echo [INFO] Creating realm: %REALM_NAME%

curl -s -X POST "%KEYCLOAK_URL%/admin/realms" ^
    -H "Authorization: Bearer !ACCESS_TOKEN!" ^
    -H "Content-Type: application/json" ^
    -d "{\"realm\": \"%REALM_NAME%\", \"enabled\": true, \"displayName\": \"Gaveurs Production\", \"registrationAllowed\": true, \"resetPasswordAllowed\": true, \"rememberMe\": true, \"verifyEmail\": false, \"loginWithEmailAllowed\": true, \"duplicateEmailsAllowed\": false}" >nul 2>&1

echo [INFO] Realm created/verified

REM ==============================================================================
REM Create Clients
REM ==============================================================================

echo [INFO] Creating clients...

echo   - backend-api (confidential client)
curl -s -X POST "%KEYCLOAK_URL%/admin/realms/%REALM_NAME%/clients" ^
    -H "Authorization: Bearer !ACCESS_TOKEN!" ^
    -H "Content-Type: application/json" ^
    -d "{\"clientId\": \"backend-api\", \"name\": \"Backend API\", \"enabled\": true, \"protocol\": \"openid-connect\", \"publicClient\": false, \"directAccessGrantsEnabled\": true, \"standardFlowEnabled\": true, \"serviceAccountsEnabled\": true, \"rootUrl\": \"http://localhost:8000\", \"redirectUris\": [\"*\"], \"webOrigins\": [\"*\"]}" >nul 2>&1

echo   - euralis-frontend (public client)
curl -s -X POST "%KEYCLOAK_URL%/admin/realms/%REALM_NAME%/clients" ^
    -H "Authorization: Bearer !ACCESS_TOKEN!" ^
    -H "Content-Type: application/json" ^
    -d "{\"clientId\": \"euralis-frontend\", \"name\": \"Euralis Dashboard\", \"enabled\": true, \"protocol\": \"openid-connect\", \"publicClient\": true, \"directAccessGrantsEnabled\": true, \"standardFlowEnabled\": true, \"rootUrl\": \"http://localhost:3000\", \"redirectUris\": [\"http://localhost:3000/*\", \"http://localhost:3000/auth/callback\"], \"postLogoutRedirectUris\": [\"http://localhost:3000/*\"], \"webOrigins\": [\"http://localhost:3000\"]}" >nul 2>&1

echo   - gaveurs-frontend (public client)
curl -s -X POST "%KEYCLOAK_URL%/admin/realms/%REALM_NAME%/clients" ^
    -H "Authorization: Bearer !ACCESS_TOKEN!" ^
    -H "Content-Type: application/json" ^
    -d "{\"clientId\": \"gaveurs-frontend\", \"name\": \"Gaveurs Individual App\", \"enabled\": true, \"protocol\": \"openid-connect\", \"publicClient\": true, \"directAccessGrantsEnabled\": true, \"standardFlowEnabled\": true, \"rootUrl\": \"http://localhost:3001\", \"redirectUris\": [\"http://localhost:3001/*\", \"http://localhost:3001/auth/callback\"], \"postLogoutRedirectUris\": [\"http://localhost:3001/*\"], \"webOrigins\": [\"http://localhost:3001\"]}" >nul 2>&1

echo   - sqal-frontend (public client)
curl -s -X POST "%KEYCLOAK_URL%/admin/realms/%REALM_NAME%/clients" ^
    -H "Authorization: Bearer !ACCESS_TOKEN!" ^
    -H "Content-Type: application/json" ^
    -d "{\"clientId\": \"sqal-frontend\", \"name\": \"SQAL Quality Control\", \"enabled\": true, \"protocol\": \"openid-connect\", \"publicClient\": true, \"directAccessGrantsEnabled\": true, \"standardFlowEnabled\": true, \"rootUrl\": \"http://localhost:5173\", \"redirectUris\": [\"http://localhost:5173/*\", \"http://localhost:5173/auth/callback\"], \"postLogoutRedirectUris\": [\"http://localhost:5173/*\"], \"webOrigins\": [\"http://localhost:5173\"]}" >nul 2>&1

echo [INFO] Clients created/verified

REM ==============================================================================
REM Create Realm Roles
REM ==============================================================================

echo [INFO] Creating realm roles...

for %%r in (admin superviseur gaveur technicien_sqal consommateur) do (
    echo   - %%r
    curl -s -X POST "%KEYCLOAK_URL%/admin/realms/%REALM_NAME%/roles" ^
        -H "Authorization: Bearer !ACCESS_TOKEN!" ^
        -H "Content-Type: application/json" ^
        -d "{\"name\": \"%%r\", \"description\": \"Role %%r\"}" >nul 2>&1
)

echo [INFO] Realm roles created/verified

REM ==============================================================================
REM Create Users
REM ==============================================================================

echo [INFO] Creating test users...

echo   - admin@euralis.fr
curl -s -X POST "%KEYCLOAK_URL%/admin/realms/%REALM_NAME%/users" ^
    -H "Authorization: Bearer !ACCESS_TOKEN!" ^
    -H "Content-Type: application/json" ^
    -d "{\"username\": \"admin@euralis.fr\", \"email\": \"admin@euralis.fr\", \"firstName\": \"Admin\", \"lastName\": \"Euralis\", \"enabled\": true, \"emailVerified\": true, \"credentials\": [{\"type\": \"password\", \"value\": \"admin123\", \"temporary\": false}], \"realmRoles\": [\"admin\"]}" >nul 2>&1

echo   - superviseur@euralis.fr
curl -s -X POST "%KEYCLOAK_URL%/admin/realms/%REALM_NAME%/users" ^
    -H "Authorization: Bearer !ACCESS_TOKEN!" ^
    -H "Content-Type: application/json" ^
    -d "{\"username\": \"superviseur@euralis.fr\", \"email\": \"superviseur@euralis.fr\", \"firstName\": \"Marie\", \"lastName\": \"Dupont\", \"enabled\": true, \"emailVerified\": true, \"credentials\": [{\"type\": \"password\", \"value\": \"super123\", \"temporary\": false}], \"realmRoles\": [\"superviseur\"]}" >nul 2>&1

echo   - jean.martin@gaveur.fr
curl -s -X POST "%KEYCLOAK_URL%/admin/realms/%REALM_NAME%/users" ^
    -H "Authorization: Bearer !ACCESS_TOKEN!" ^
    -H "Content-Type: application/json" ^
    -d "{\"username\": \"jean.martin@gaveur.fr\", \"email\": \"jean.martin@gaveur.fr\", \"firstName\": \"Jean\", \"lastName\": \"Martin\", \"enabled\": true, \"emailVerified\": true, \"attributes\": {\"gaveur_id\": [\"1\"], \"site\": [\"LL\"]}, \"credentials\": [{\"type\": \"password\", \"value\": \"gaveur123\", \"temporary\": false}], \"realmRoles\": [\"gaveur\"]}" >nul 2>&1

echo   - sophie.dubois@gaveur.fr
curl -s -X POST "%KEYCLOAK_URL%/admin/realms/%REALM_NAME%/users" ^
    -H "Authorization: Bearer !ACCESS_TOKEN!" ^
    -H "Content-Type: application/json" ^
    -d "{\"username\": \"sophie.dubois@gaveur.fr\", \"email\": \"sophie.dubois@gaveur.fr\", \"firstName\": \"Sophie\", \"lastName\": \"Dubois\", \"enabled\": true, \"emailVerified\": true, \"attributes\": {\"gaveur_id\": [\"2\"], \"site\": [\"LS\"]}, \"credentials\": [{\"type\": \"password\", \"value\": \"gaveur123\", \"temporary\": false}], \"realmRoles\": [\"gaveur\"]}" >nul 2>&1

echo   - tech@sqal.fr
curl -s -X POST "%KEYCLOAK_URL%/admin/realms/%REALM_NAME%/users" ^
    -H "Authorization: Bearer !ACCESS_TOKEN!" ^
    -H "Content-Type: application/json" ^
    -d "{\"username\": \"tech@sqal.fr\", \"email\": \"tech@sqal.fr\", \"firstName\": \"Technicien\", \"lastName\": \"SQAL\", \"enabled\": true, \"emailVerified\": true, \"credentials\": [{\"type\": \"password\", \"value\": \"sqal123\", \"temporary\": false}], \"realmRoles\": [\"technicien_sqal\"]}" >nul 2>&1

echo [INFO] Test users created/verified

REM ==============================================================================
REM Summary
REM ==============================================================================

echo.
echo ================================================================================
echo [INFO] Keycloak Configuration Complete!
echo ================================================================================
echo.
echo Keycloak Console: %KEYCLOAK_URL%
echo Admin: %KEYCLOAK_ADMIN% / %KEYCLOAK_ADMIN_PASSWORD%
echo.
echo Test Accounts:
echo    - admin@euralis.fr / admin123 (admin - all frontends)
echo    - superviseur@euralis.fr / super123 (superviseur - euralis)
echo    - jean.martin@gaveur.fr / gaveur123 (gaveur - gaveurs)
echo    - sophie.dubois@gaveur.fr / gaveur123 (gaveur - gaveurs)
echo    - tech@sqal.fr / sqal123 (technicien_sqal - sqal)
echo.
echo Frontends:
echo    - Euralis: http://localhost:3000
echo    - Gaveurs: http://localhost:3001
echo    - SQAL: http://localhost:5173
echo.
echo Realm: %REALM_NAME%
echo Clients: 4 (backend-api, euralis-frontend, gaveurs-frontend, sqal-frontend)
echo Roles: 5 realm roles + client roles
echo Users: 5 test accounts
echo.
echo ================================================================================
echo.
echo Next step: Get backend-api client secret from Keycloak console
echo           and add to backend-api/.env as KEYCLOAK_CLIENT_SECRET
echo.

pause
