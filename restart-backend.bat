@echo off
echo ================================================
echo Redemarrage du Backend FastAPI
echo ================================================

REM Tuer le processus existant
echo 1. Arret du backend en cours...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8000" ^| findstr "LISTENING"') do (
    echo    - Arret du PID %%a
    taskkill /F /PID %%a >nul 2>&1
)

REM Attendre 2 secondes
timeout /t 2 /nobreak >nul

REM Redemarrer le backend
echo 2. Demarrage du backend avec correction cluster...
cd backend-api
set DATABASE_URL=postgresql://gaveurs_admin:gaveurs_secure_2024@localhost:5432/gaveurs_db

echo 3. Lancement uvicorn...
echo    URL: http://localhost:8000
echo    Docs: http://localhost:8000/docs
echo.
echo IMPORTANT: Laissez cette fenetre ouverte!
echo Appuyez sur Ctrl+C pour arreter le backend
echo.

call venv\Scripts\activate.bat
uvicorn app.main:app --reload --port 8000
