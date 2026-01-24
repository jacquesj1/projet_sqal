@echo off
echo ========================================
echo Starting Keycloak for Gaveurs System
echo ========================================

REM Check if network exists, create if not
docker network inspect gaveurs-network >nul 2>&1
if %errorlevel% neq 0 (
    echo Creating Docker network: gaveurs-network
    docker network create gaveurs-network
)

REM Start Keycloak
echo Starting Keycloak services...
docker-compose -f docker-compose.keycloak.yml up -d

echo.
echo ========================================
echo Keycloak is starting...
echo ========================================
echo.
echo Access Keycloak Admin Console:
echo   URL: http://localhost:8080
echo   Username: admin
echo   Password: admin_secure_2024
echo.
echo Waiting for Keycloak to be ready (60 seconds)...
timeout /t 60 /nobreak >nul

echo.
echo Check status with: docker-compose -f docker-compose.keycloak.yml ps
echo View logs with: docker logs -f gaveurs-keycloak
echo.
pause
