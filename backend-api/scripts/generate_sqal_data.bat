@echo off
REM ============================================================================
REM Script Windows: Génération données SQAL test
REM ============================================================================

echo.
echo ================================================================================
echo GENERATION DONNEES SQAL TEST
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

REM Lancer le script de génération
echo Lancement generation SQAL...
echo.

python scripts\generate_sqal_test_data.py %*

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ================================================================================
    echo GENERATION TERMINEE AVEC SUCCES
    echo ================================================================================
    echo.
) else (
    echo.
    echo ================================================================================
    echo ERREUR LORS DE LA GENERATION
    echo ================================================================================
    echo.
)

pause
