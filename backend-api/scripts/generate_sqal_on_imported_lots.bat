@echo off
REM ============================================================================
REM Script Windows: Générer données SQAL sur lots importés depuis CSV
REM ============================================================================

echo.
echo ================================================================================
echo GENERATION DONNEES SQAL SUR LOTS IMPORTES
echo ================================================================================
echo.

cd /d "%~dp0.."

REM Activer l'environnement virtuel
call venv\Scripts\activate.bat

REM Vérifier DATABASE_URL
if "%DATABASE_URL%"=="" (
    echo Configuration DATABASE_URL...
    set DATABASE_URL=postgresql://gaveurs_admin:gaveurs_secure_2024@localhost:5432/gaveurs_db
)

echo DATABASE_URL: %DATABASE_URL%
echo.

REM Générer SQAL sur lots CSV (code_lot LIKE 'LL%%')
echo Génération données SQAL sur 75 lots importés...
echo.

python scripts\generate_sqal_test_data.py --nb-lots 75 --samples-per-lot 30 --filter-csv

pause
