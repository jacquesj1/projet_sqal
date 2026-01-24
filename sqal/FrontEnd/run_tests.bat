@echo off
REM ============================================================================
REM Script de test pour SQAL Frontend (Windows)
REM Exécute les tests Jest avec différentes options
REM ============================================================================

setlocal

REM Parse command
set COMMAND=%1
if "%COMMAND%"=="" set COMMAND=all

echo ========================================
echo   SQAL Frontend - Tests Jest
echo ========================================
echo.

REM Check if node_modules exists
if not exist "node_modules\" (
  echo [WARNING] node_modules not found. Running npm install...
  call npm install
)

REM Execute command
if "%COMMAND%"=="install" goto :install
if "%COMMAND%"=="deps" goto :install
if "%COMMAND%"=="all" goto :all
if "%COMMAND%"=="unit" goto :unit
if "%COMMAND%"=="components" goto :components
if "%COMMAND%"=="services" goto :services
if "%COMMAND%"=="watch" goto :watch
if "%COMMAND%"=="coverage" goto :coverage
if "%COMMAND%"=="verbose" goto :verbose
if "%COMMAND%"=="-v" goto :verbose
if "%COMMAND%"=="clear" goto :clear
if "%COMMAND%"=="update" goto :update
if "%COMMAND%"=="ci" goto :ci
if "%COMMAND%"=="help" goto :help
if "%COMMAND%"=="-h" goto :help
if "%COMMAND%"=="--help" goto :help

echo [ERROR] Unknown command: %COMMAND%
echo Use 'run_tests.bat help' to see available commands
exit /b 1

:install
  echo Installing test dependencies...
  call npm install --save-dev jest @testing-library/react @testing-library/jest-dom @testing-library/user-event jest-environment-jsdom ts-jest @types/jest
  echo [SUCCESS] Dependencies installed
  goto :end

:all
  echo Running all tests with coverage...
  call npm test -- --coverage
  goto :end

:unit
  echo Running unit tests...
  call npm test -- --testPathPattern="__tests__" --coverage
  goto :end

:components
  echo Running component tests...
  call npm test -- --testPathPattern="components.*test" --coverage
  goto :end

:services
  echo Running service tests...
  call npm test -- --testPathPattern="services.*test" --coverage
  goto :end

:watch
  echo Running tests in watch mode...
  call npm run test:watch
  goto :end

:coverage
  echo Generating coverage report...
  call npm test -- --coverage --coverageReporters=html
  echo [SUCCESS] Coverage report generated in ./coverage/index.html
  goto :end

:verbose
  echo Running tests (verbose mode)...
  call npm test -- --verbose --coverage
  goto :end

:clear
  echo Clearing Jest cache...
  call npm test -- --clearCache
  echo [SUCCESS] Cache cleared
  goto :end

:update
  echo Updating snapshots...
  call npm test -- -u
  echo [SUCCESS] Snapshots updated
  goto :end

:ci
  echo Running tests (CI mode)...
  call npm test -- --ci --coverage --maxWorkers=2
  goto :end

:help
  echo Usage: run_tests.bat [COMMAND]
  echo.
  echo Commands:
  echo   install, deps    - Install test dependencies
  echo   all              - Run all tests with coverage (default)
  echo   unit             - Run unit tests only
  echo   components       - Run component tests
  echo   services         - Run service tests
  echo   watch            - Run tests in watch mode
  echo   coverage         - Generate HTML coverage report
  echo   verbose, -v      - Run tests in verbose mode
  echo   clear            - Clear Jest cache
  echo   update           - Update snapshots
  echo   ci               - Run tests in CI mode
  echo   help, -h         - Show this help
  echo.
  echo Examples:
  echo   run_tests.bat all
  echo   run_tests.bat components
  echo   run_tests.bat coverage
  goto :end

:end
  echo.
  echo [SUCCESS] Tests completed!
  endlocal
