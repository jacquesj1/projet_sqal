@echo off
REM ============================================================================
REM Script Windows: Import données CSV réelles
REM ============================================================================

echo.
echo ================================================================================
echo IMPORT DONNEES REELLES CSV
echo ================================================================================
echo.

cd /d "%~dp0.."

REM Vérifier que l'environnement virtuel existe
if not exist "venv\Scripts\activate.bat" (
    echo Erreur: Environnement virtuel non trouve
    echo Veuillez creer l'environnement avec: python -m venv venv
    pause
    exit /b 1
)

REM Activer l'environnement virtuel
call venv\Scripts\activate.bat

REM Vérifier DATABASE_URL
if "%DATABASE_URL%"=="" (
    echo Configuration DATABASE_URL...
    set DATABASE_URL=postgresql://gaveurs_admin:gaveurs_secure_2024@localhost:5432/gaveurs_db
)

echo DATABASE_URL: %DATABASE_URL%
echo.

REM Vérifier si --dry-run est passé
set DRY_RUN=
if "%1"=="--dry-run" set DRY_RUN=--dry-run

REM Lancer le script d'import
echo Lancement import CSV...
echo.

python scripts\import_csv_real_data.py %DRY_RUN%

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ================================================================================
    echo IMPORT TERMINE AVEC SUCCES
    echo ================================================================================
    echo.
) else (
    echo.
    echo ================================================================================
    echo ERREUR LORS DE L'IMPORT
    echo ================================================================================
    echo.
)

pause
