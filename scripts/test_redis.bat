@echo off
REM Script de test Redis pour Windows
REM ===================================
REM Vérifie que Redis est accessible et fonctionne correctement

echo ==========================================
echo Test de connexion Redis
echo ==========================================
echo.

REM Configuration
set REDIS_HOST=localhost
set REDIS_PORT=6379

echo Test 1: Vérifier si Redis est accessible...
docker exec gaveurs_redis redis-cli ping >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo [OK] Redis répond au PING
) else (
    echo [ERREUR] Redis ne répond pas
    exit /b 1
)

echo.
echo Test 2: Tester SET/GET...
docker exec gaveurs_redis redis-cli SET test_key "Hello Redis" >nul 2>&1
for /f "delims=" %%i in ('docker exec gaveurs_redis redis-cli GET test_key') do set VALUE=%%i
if "%VALUE%"=="Hello Redis" (
    echo [OK] SET/GET fonctionne correctement
    docker exec gaveurs_redis redis-cli DEL test_key >nul 2>&1
) else (
    echo [ERREUR] SET/GET échoué
    exit /b 1
)

echo.
echo Test 3: Vérifier les informations Redis...
for /f "tokens=*" %%i in ('docker exec gaveurs_redis redis-cli INFO server ^| findstr redis_version') do (
    echo [OK] %%i
)

echo.
echo ==========================================
echo [OK] Tous les tests Redis ont réussi!
echo ==========================================
