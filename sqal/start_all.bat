@echo off
REM ============================================================================
REM SQAL - Script de Lancement Automatique (Windows)
REM Lance tous les services nécessaires pour tester le dashboard
REM ============================================================================

echo.
echo ============================================================================
echo   SQAL Dashboard - Lancement Automatique
echo ============================================================================
echo.

REM Vérifier que Docker Desktop est lancé
docker ps >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERREUR] Docker Desktop n'est pas lance ou n'est pas accessible
    echo Veuillez demarrer Docker Desktop et reessayer
    pause
    exit /b 1
)

echo [1/5] Demarrage de l'infrastructure Docker...
docker-compose up -d timescaledb redis
if %errorlevel% neq 0 (
    echo [ERREUR] Echec du demarrage Docker
    pause
    exit /b 1
)

echo [OK] Infrastructure Docker demarree
echo.

echo [2/5] Attente demarrage TimescaleDB (10 secondes)...
timeout /t 10 /nobreak >nul

echo [3/5] Demarrage du Backend FastAPI...
start "SQAL Backend" cmd /k "cd backend_new && python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"

echo [4/5] Attente demarrage Backend (5 secondes)...
timeout /t 5 /nobreak >nul

echo [5/5] Demarrage du Simulateur ESP32...
start "SQAL Simulator" cmd /k "cd simulator && python esp32_simulator.py --url ws://localhost:8000/ws/sensors/ --rate 0.5"

echo.
echo ============================================================================
echo   Tous les services sont lances !
echo ============================================================================
echo.
echo Services actifs :
echo   - TimescaleDB    : localhost:5434
echo   - Redis          : localhost:6380
echo   - Backend API    : http://localhost:8000
echo   - Simulateur     : Envoie donnees via WebSocket
echo.
echo Pour demarrer le Frontend :
echo   1. Ouvrir un nouveau terminal
echo   2. cd sqal
echo   3. npm run dev
echo   4. Ouvrir http://localhost:5173/dashboard
echo.
echo Pour arreter tous les services :
echo   - Fermer les fenetres de terminal
echo   - Executer : docker-compose down
echo.
pause
