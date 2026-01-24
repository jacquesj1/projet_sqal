@echo off
REM ============================================================================
REM Script de déploiement du schéma LOT-centric
REM ============================================================================

echo.
echo ====================================================================
echo   Deploiement schema LOT-centric - Systeme Gaveurs V3.0
echo ====================================================================
echo.

REM Vérifier que Docker est en cours d'exécution
docker ps >nul 2>&1
if %errorlevel% neq 0 (
    echo ERREUR: Docker n'est pas en cours d'execution
    echo Demarrez Docker Desktop et reessayez
    pause
    exit /b 1
)

echo [1/5] Verification du container TimescaleDB...
docker ps | findstr timescaledb >nul
if %errorlevel% neq 0 (
    echo ERREUR: Le container TimescaleDB n'est pas en cours d'execution
    echo Lancez: docker-compose up -d timescaledb
    pause
    exit /b 1
)
echo OK - TimescaleDB est en cours d'execution

echo.
echo [2/5] Copie du fichier SQL dans le container...
docker cp backend-api\scripts\lots_schema.sql gaveurs_timescaledb:/tmp/lots_schema.sql
if %errorlevel% neq 0 (
    echo ERREUR: Impossible de copier le fichier SQL
    pause
    exit /b 1
)
echo OK - Fichier copie

echo.
echo [3/5] Application du schema SQL...
docker exec -i gaveurs_timescaledb psql -U gaveurs_admin -d gaveurs_db -f /tmp/lots_schema.sql
if %errorlevel% neq 0 (
    echo ERREUR: Echec de l'application du schema
    pause
    exit /b 1
)
echo OK - Schema applique

echo.
echo [4/5] Verification des tables creees...
docker exec -it gaveurs_timescaledb psql -U gaveurs_admin -d gaveurs_db -c "\dt" | findstr lots
echo.

echo.
echo [5/5] Verification de l'hypertable TimescaleDB...
docker exec -it gaveurs_timescaledb psql -U gaveurs_admin -d gaveurs_db -c "SELECT hypertable_name FROM timescaledb_information.hypertables WHERE hypertable_name = 'gavage_lot_quotidien';"
echo.

echo ====================================================================
echo   Deploiement termine avec succes !
echo ====================================================================
echo.
echo Prochaines etapes:
echo   1. Demarrer le backend:
echo      cd backend-api
echo      venv\Scripts\activate
echo      uvicorn app.main:app --reload
echo.
echo   2. Demarrer le frontend:
echo      cd gaveurs-frontend
echo      npm run dev
echo.
echo   3. Ouvrir dans le navigateur:
echo      http://localhost:3000/lots
echo.
echo ====================================================================

pause
