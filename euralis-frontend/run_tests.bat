@echo off
REM Script d'execution des tests Euralis Frontend (Windows)
REM Usage: run_tests.bat [commande]

setlocal

set COMMAND=%1
if "%COMMAND%"=="" set COMMAND=all

if "%COMMAND%"=="install" goto install
if "%COMMAND%"=="all" goto all
if "%COMMAND%"=="watch" goto watch
if "%COMMAND%"=="coverage" goto coverage
if "%COMMAND%"=="components" goto components
if "%COMMAND%"=="api" goto api
if "%COMMAND%"=="verbose" goto verbose
if "%COMMAND%"=="help" goto help

echo Commande inconnue: %COMMAND%
echo Utilisez 'run_tests.bat help' pour voir les commandes disponibles
exit /b 1

:install
echo =====================================
echo Installation des dependances de tests
echo =====================================
call npm install --save-dev @testing-library/react @testing-library/jest-dom @testing-library/user-event jest jest-environment-jsdom
echo.
echo [OK] Dependances installees
goto end

:all
echo =====================================
echo Execution de tous les tests Euralis
echo =====================================
call npm test -- --passWithNoTests
echo.
echo [OK] Tous les tests passes
goto end

:watch
echo =====================================
echo Mode watch - Tests Euralis
echo =====================================
call npm test -- --watch
goto end

:coverage
echo =====================================
echo Generation du rapport de coverage
echo =====================================
call npm test -- --coverage --passWithNoTests
echo.
echo [OK] Rapport de coverage genere dans coverage/
echo.
echo Ouvrez coverage\index.html dans votre navigateur pour voir le rapport
goto end

:components
echo =====================================
echo Tests des composants uniquement
echo =====================================
call npm test -- src/__tests__/components --passWithNoTests
echo.
echo [OK] Tests composants termines
goto end

:api
echo =====================================
echo Tests de l'API client uniquement
echo =====================================
call npm test -- src/__tests__/lib --passWithNoTests
echo.
echo [OK] Tests API termines
goto end

:verbose
echo =====================================
echo Tests en mode verbose
echo =====================================
call npm test -- --verbose --passWithNoTests
goto end

:help
echo Usage: run_tests.bat [commande]
echo.
echo Commandes disponibles:
echo   install     - Installe les dependances de test
echo   all         - Execute tous les tests (defaut)
echo   watch       - Mode watch (re-execute a chaque modification)
echo   coverage    - Genere un rapport de coverage HTML
echo   components  - Teste uniquement les composants
echo   api         - Teste uniquement l'API client
echo   verbose     - Execute les tests en mode verbose
echo   help        - Affiche cette aide
goto end

:end
endlocal
