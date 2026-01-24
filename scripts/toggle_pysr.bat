@echo off
REM ============================================
REM Script de Basculement PySR (Régression Symbolique) - Windows
REM ============================================
REM Usage:
REM   scripts\toggle_pysr.bat enable   # Activer PySR
REM   scripts\toggle_pysr.bat disable  # Désactiver PySR
REM   scripts\toggle_pysr.bat status   # Vérifier l'état
REM ============================================

setlocal EnableDelayedExpansion

REM Fichiers à modifier
set "MAIN_PY=backend-api\app\main.py"
set "DOSE_SERVICE_PY=backend-api\app\services\dose_correction_service.py"

REM Couleurs (approximatives pour Windows)
set "COLOR_RED=[91m"
set "COLOR_GREEN=[92m"
set "COLOR_YELLOW=[93m"
set "COLOR_BLUE=[94m"
set "COLOR_RESET=[0m"

if "%1"=="" goto usage
if /i "%1"=="enable" goto enable_pysr
if /i "%1"=="disable" goto disable_pysr
if /i "%1"=="status" goto show_status
goto usage

:enable_pysr
echo.
echo %COLOR_BLUE%🔧 Activation de PySR (Régression Symbolique)...%COLOR_RESET%
echo.

REM Étape 1: Modification de main.py
echo %COLOR_YELLOW%📝 Étape 1/5: Modification de app\main.py...%COLOR_RESET%
if not exist "%MAIN_PY%" (
    echo %COLOR_RED%  ❌ Fichier %MAIN_PY% non trouvé%COLOR_RESET%
    exit /b 1
)

REM Utiliser PowerShell pour les modifications de fichiers
powershell -Command "(Get-Content '%MAIN_PY%') -replace '^# TEMPORAIRE: PySR désactivé pour démarrage rapide \(Julia installation longue\)$', '' | Set-Content '%MAIN_PY%'"
powershell -Command "(Get-Content '%MAIN_PY%') -replace '^# from app\.ml\.symbolic_regression import get_symbolic_engine$', 'from app.ml.symbolic_regression import get_symbolic_engine' | Set-Content '%MAIN_PY%'"

echo %COLOR_GREEN%  ✅ app\main.py modifié%COLOR_RESET%

REM Étape 2: Modification de dose_correction_service.py
echo %COLOR_YELLOW%📝 Étape 2/5: Modification de app\services\dose_correction_service.py...%COLOR_RESET%
if not exist "%DOSE_SERVICE_PY%" (
    echo %COLOR_RED%  ❌ Fichier %DOSE_SERVICE_PY% non trouvé%COLOR_RESET%
    exit /b 1
)

powershell -Command "(Get-Content '%DOSE_SERVICE_PY%') -replace '^# TEMPORAIRE: PySR désactivé pour démarrage rapide$', '' | Set-Content '%DOSE_SERVICE_PY%'"
powershell -Command "(Get-Content '%DOSE_SERVICE_PY%') -replace '^# from app\.ml\.symbolic_regression import get_symbolic_engine$', 'from app.ml.symbolic_regression import get_symbolic_engine' | Set-Content '%DOSE_SERVICE_PY%'"

echo %COLOR_GREEN%  ✅ dose_correction_service.py modifié%COLOR_RESET%

REM Étape 3: Installation des packages Julia
echo %COLOR_YELLOW%📦 Étape 3/5: Installation des packages Julia...%COLOR_RESET%
docker-compose ps backend | findstr "Up" >nul 2>&1
if %errorlevel%==0 (
    echo %COLOR_BLUE%  ⏳ Installation de SymbolicRegression.jl...%COLOR_RESET%
    docker-compose exec -T backend julia -e "using Pkg; Pkg.add(\"SymbolicRegression\")"
    if %errorlevel%==0 (
        echo %COLOR_GREEN%  ✅ Packages Julia configurés%COLOR_RESET%
    ) else (
        echo %COLOR_YELLOW%  ⚠️  Installation Julia échouée (peut-être déjà installé)%COLOR_RESET%
    )
) else (
    echo %COLOR_YELLOW%  ⚠️  Backend non démarré, packages Julia non installés%COLOR_RESET%
    echo %COLOR_YELLOW%  ℹ️  Démarrez le backend puis exécutez:%COLOR_RESET%
    echo %COLOR_YELLOW%     docker-compose exec backend julia -e "using Pkg; Pkg.add(\"SymbolicRegression\")"% COLOR_RESET%
)

REM Étape 4: Rebuild du backend
echo %COLOR_YELLOW%🔨 Étape 4/5: Rebuild du backend...%COLOR_RESET%
docker-compose build backend
if %errorlevel%==0 (
    echo %COLOR_GREEN%  ✅ Backend rebuild%COLOR_RESET%
) else (
    echo %COLOR_RED%  ❌ Rebuild échoué%COLOR_RESET%
    exit /b 1
)

REM Étape 5: Redémarrage du backend
echo %COLOR_YELLOW%🔄 Étape 5/5: Redémarrage du backend...%COLOR_RESET%
docker-compose restart backend
if %errorlevel%==0 (
    echo %COLOR_GREEN%  ✅ Backend redémarré%COLOR_RESET%

    REM Attendre que le backend soit prêt
    echo %COLOR_BLUE%  ⏳ Attente du démarrage (30s)...%COLOR_RESET%
    timeout /t 30 /nobreak >nul

    REM Test du endpoint
    echo %COLOR_YELLOW%  🧪 Test du backend...%COLOR_RESET%
    curl -s http://localhost:8000/health >nul 2>&1
    if %errorlevel%==0 (
        echo %COLOR_GREEN%  ✅ Backend opérationnel%COLOR_RESET%
    ) else (
        echo %COLOR_RED%  ❌ Backend non accessible%COLOR_RESET%
    )
) else (
    echo %COLOR_RED%  ❌ Redémarrage échoué%COLOR_RESET%
    exit /b 1
)

echo.
echo %COLOR_GREEN%✅ PySR ACTIVÉ avec succès!%COLOR_RESET%
echo.
echo %COLOR_BLUE%📊 Endpoints PySR disponibles:%COLOR_RESET%
echo %COLOR_BLUE%  - POST /api/ml/discover-formula/{genetique}%COLOR_RESET%
echo %COLOR_BLUE%  - GET  /api/ml/predict-doses/{canard_id}%COLOR_RESET%
echo.
goto :eof

:disable_pysr
echo.
echo %COLOR_BLUE%🔧 Désactivation de PySR (mode rapide)...%COLOR_RESET%
echo.

REM Étape 1: Modification de main.py
echo %COLOR_YELLOW%📝 Étape 1/3: Modification de app\main.py...%COLOR_RESET%
if not exist "%MAIN_PY%" (
    echo %COLOR_RED%  ❌ Fichier %MAIN_PY% non trouvé%COLOR_RESET%
    exit /b 1
)

powershell -Command "(Get-Content '%MAIN_PY%') -replace '^from app\.ml\.symbolic_regression import get_symbolic_engine$', '# TEMPORAIRE: PySR désactivé pour démarrage rapide (Julia installation longue)`n# from app.ml.symbolic_regression import get_symbolic_engine' | Set-Content '%MAIN_PY%'"

echo %COLOR_GREEN%  ✅ app\main.py modifié%COLOR_RESET%

REM Étape 2: Modification de dose_correction_service.py
echo %COLOR_YELLOW%📝 Étape 2/3: Modification de app\services\dose_correction_service.py...%COLOR_RESET%
if not exist "%DOSE_SERVICE_PY%" (
    echo %COLOR_RED%  ❌ Fichier %DOSE_SERVICE_PY% non trouvé%COLOR_RESET%
    exit /b 1
)

powershell -Command "(Get-Content '%DOSE_SERVICE_PY%') -replace '^from app\.ml\.symbolic_regression import get_symbolic_engine$', '# TEMPORAIRE: PySR désactivé pour démarrage rapide`n# from app.ml.symbolic_regression import get_symbolic_engine' | Set-Content '%DOSE_SERVICE_PY%'"

echo %COLOR_GREEN%  ✅ dose_correction_service.py modifié%COLOR_RESET%

REM Étape 3: Redémarrage du backend
echo %COLOR_YELLOW%🔄 Étape 3/3: Redémarrage du backend...%COLOR_RESET%
docker-compose restart backend
if %errorlevel%==0 (
    echo %COLOR_GREEN%  ✅ Backend redémarré%COLOR_RESET%

    REM Attendre que le backend soit prêt
    echo %COLOR_BLUE%  ⏳ Attente du démarrage (15s)...%COLOR_RESET%
    timeout /t 15 /nobreak >nul

    REM Test du endpoint
    echo %COLOR_YELLOW%  🧪 Test du backend...%COLOR_RESET%
    curl -s http://localhost:8000/health >nul 2>&1
    if %errorlevel%==0 (
        echo %COLOR_GREEN%  ✅ Backend opérationnel (mode rapide)%COLOR_RESET%
    ) else (
        echo %COLOR_RED%  ❌ Backend non accessible%COLOR_RESET%
    )
) else (
    echo %COLOR_RED%  ❌ Redémarrage échoué%COLOR_RESET%
    exit /b 1
)

echo.
echo %COLOR_GREEN%✅ PySR DÉSACTIVÉ avec succès!%COLOR_RESET%
echo.
echo %COLOR_YELLOW%ℹ️  Mode: Doses standards (empiriques)%COLOR_RESET%
echo %COLOR_YELLOW%ℹ️  Démarrage backend: ~15s au lieu de ~2min%COLOR_RESET%
echo.
goto :eof

:show_status
echo.
echo %COLOR_BLUE%📊 État de PySR (Régression Symbolique)%COLOR_RESET%
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

REM Vérifier si PySR est activé
findstr /B "from app.ml.symbolic_regression import get_symbolic_engine" "%MAIN_PY%" >nul 2>&1
if %errorlevel%==0 (
    echo %COLOR_GREEN%✅ PySR: ACTIVÉ%COLOR_RESET%
    echo.
    echo Fonctionnalités disponibles:
    echo   - Découverte de formules symboliques optimales
    echo   - Calcul de doses théoriques par IA
    echo   - Endpoints ML actifs
    echo.
    echo Endpoints:
    echo   POST /api/ml/discover-formula/{genetique}
    echo   GET  /api/ml/predict-doses/{canard_id}
) else (
    echo %COLOR_RED%❌ PySR: DÉSACTIVÉ%COLOR_RESET%
    echo.
    echo Mode actuel:
    echo   - Doses standards (empiriques)
    echo   - Démarrage rapide (~15s)
    echo   - Pas de dépendance Julia
    echo.
    echo Pour activer PySR:
    echo   scripts\toggle_pysr.bat enable
)

echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo.

REM Vérifier si Julia est installé
docker-compose ps backend | findstr "Up" >nul 2>&1
if %errorlevel%==0 (
    echo %COLOR_BLUE%🔍 Vérification Julia dans le container...%COLOR_RESET%
    docker-compose exec -T backend julia --version >nul 2>&1
    if %errorlevel%==0 (
        for /f "delims=" %%i in ('docker-compose exec -T backend julia --version') do set "JULIA_VERSION=%%i"
        echo %COLOR_GREEN%  ✅ Julia installé: !JULIA_VERSION!%COLOR_RESET%
    ) else (
        echo %COLOR_RED%  ❌ Julia non installé%COLOR_RESET%
    )
) else (
    echo %COLOR_YELLOW%  ⚠️  Backend non démarré%COLOR_RESET%
)

echo.
goto :eof

:usage
echo.
echo %COLOR_RED%❌ Usage invalide%COLOR_RESET%
echo.
echo Usage:
echo   %0 enable    # Activer PySR (régression symbolique)
echo   %0 disable   # Désactiver PySR (mode rapide)
echo   %0 status    # Vérifier l'état actuel
echo.
echo Exemples:
echo   scripts\toggle_pysr.bat enable   # Activer avec Julia
echo   scripts\toggle_pysr.bat disable  # Mode rapide sans Julia
echo   scripts\toggle_pysr.bat status   # Voir l'état
echo.
exit /b 1
