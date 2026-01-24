@echo off
REM Script pour démarrer le backend localement (pas dans Docker)
REM Nécessaire pour que le Control Panel puisse lancer les simulateurs

echo ========================================
echo Démarrage Backend API en mode local
echo ========================================
echo.

cd backend-api

echo Configuration des variables d'environnement...
set DATABASE_HOST=localhost
set DATABASE_PORT=5432
set DATABASE_NAME=gaveurs_db
set DATABASE_USER=gaveurs_admin
set DATABASE_PASSWORD=gaveurs_secure_2024
set DATABASE_URL=postgresql://gaveurs_admin:gaveurs_secure_2024@localhost:5432/gaveurs_db?sslmode=disable
set REDIS_HOST=localhost
set REDIS_PORT=6379

echo.
echo Activation de l'environnement virtuel...
call venvW\Scripts\activate.bat

echo.
echo Démarrage du serveur FastAPI sur http://localhost:8000
echo Appuyez sur Ctrl+C pour arrêter
echo.

uvicorn app.main:app --reload --port 8000 --host 0.0.0.0
