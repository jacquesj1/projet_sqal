@echo off
REM ============================================================================
REM Script Windows: Exécuter migration SQL
REM ============================================================================

echo.
echo ================================================================================
echo EXECUTION MIGRATION SQL
echo ================================================================================
echo.

cd /d "%~dp0.."

REM Activer l'environnement virtuel
if not exist "venv\Scripts\activate.bat" (
    echo Erreur: Environnement virtuel non trouve
    echo Veuillez creer l'environnement avec: python -m venv venv
    pause
    exit /b 1
)

call venv\Scripts\activate.bat

REM Vérifier DATABASE_URL
if "%DATABASE_URL%"=="" (
    echo Configuration DATABASE_URL...
    set DATABASE_URL=postgresql://gaveurs_admin:gaveurs_secure_2024@localhost:5432/gaveurs_db
)

echo DATABASE_URL: %DATABASE_URL%
echo.

REM Récupérer le nom du fichier de migration (par défaut: migration_add_csv_columns.sql)
set MIGRATION_FILE=%1
if "%MIGRATION_FILE%"=="" set MIGRATION_FILE=migration_add_csv_columns.sql

echo Migration: %MIGRATION_FILE%
echo.

REM Exécuter la migration
python scripts\run_migration.py %MIGRATION_FILE%

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ================================================================================
    echo MIGRATION TERMINEE AVEC SUCCES
    echo ================================================================================
    echo.
) else (
    echo.
    echo ================================================================================
    echo ERREUR LORS DE LA MIGRATION
    echo ================================================================================
    echo.
)

pause
