@echo off
REM Test login endpoint Windows

echo Testing /api/auth/login endpoint...
echo.

echo Test 1: Admin Keycloak
curl -X POST http://localhost:8000/api/auth/login -H "Content-Type: application/json" -d "{\"username\": \"admin@euralis.fr\", \"password\": \"admin123\"}"
echo.
echo ---
echo.

echo Test 2: Superviseur
curl -X POST http://localhost:8000/api/auth/login -H "Content-Type: application/json" -d "{\"username\": \"superviseur@euralis.fr\", \"password\": \"super123\"}"
echo.
echo ---
echo.

echo Test 3: Bad credentials (devrait echouer)
curl -X POST http://localhost:8000/api/auth/login -H "Content-Type: application/json" -d "{\"username\": \"invalid@test.fr\", \"password\": \"wrongpass\"}"
echo.
