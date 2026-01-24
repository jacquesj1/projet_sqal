@echo off
REM ============================================================================
REM Script de démarrage de l'API Docker Control
REM ============================================================================

echo.
echo ============================================================================
echo     API Docker Control - Simulateurs Gaveurs V3.0
echo ============================================================================
echo.

REM Vérifier si Python est installé
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERREUR] Python n'est pas installe ou pas dans le PATH
    echo.
    echo Installez Python depuis: https://www.python.org/downloads/
    pause
    exit /b 1
)

REM Créer un environnement virtuel s'il n'existe pas
if not exist "venv" (
    echo [INFO] Creation de l'environnement virtuel...
    python -m venv venv
)

REM Activer l'environnement virtuel
echo [INFO] Activation de l'environnement virtuel...
call venv\Scripts\activate.bat

REM Installer les dépendances
echo [INFO] Installation des dependances...
pip install -q --upgrade pip
pip install -q -r requirements.txt

REM Démarrer l'API
echo.
echo ============================================================================
echo [INFO] Demarrage de l'API sur http://localhost:8889
echo [INFO] Documentation disponible sur http://localhost:8889/docs
echo ============================================================================
echo.

python docker_api.py

pause
