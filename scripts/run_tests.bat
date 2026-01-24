@echo off
REM ==============================================================================
REM Test Runner Script for Système Gaveurs V3.0 (Windows)
REM ==============================================================================
REM Usage:
REM   scripts\run_tests.bat [all|unit|integration|e2e|websocket|coverage]
REM ==============================================================================

setlocal enabledelayedexpansion

set "PROJECT_ROOT=%~dp0.."
cd /d "%PROJECT_ROOT%"

set "TEST_TYPE=%~1"
if "%TEST_TYPE%"=="" set "TEST_TYPE=all"

echo ===================================================================
echo Système Gaveurs V3.0 - Test Runner (Windows)
echo ===================================================================
echo.

if "%TEST_TYPE%"=="install" goto INSTALL_DEPS
if "%TEST_TYPE%"=="deps" goto INSTALL_DEPS
if "%TEST_TYPE%"=="unit" goto RUN_UNIT
if "%TEST_TYPE%"=="integration" goto RUN_INTEGRATION
if "%TEST_TYPE%"=="e2e" goto RUN_E2E
if "%TEST_TYPE%"=="websocket" goto RUN_WEBSOCKET
if "%TEST_TYPE%"=="ws" goto RUN_WEBSOCKET
if "%TEST_TYPE%"=="all" goto RUN_ALL
if "%TEST_TYPE%"=="coverage" goto RUN_COVERAGE
if "%TEST_TYPE%"=="cov" goto RUN_COVERAGE

echo [ERROR] Unknown test type: %TEST_TYPE%
echo.
echo Usage: %0 [all^|unit^|integration^|e2e^|websocket^|coverage^|install]
exit /b 1

:INSTALL_DEPS
echo [INFO] Installing test dependencies...

if not exist "backend-api\venv" (
    echo [ERROR] Backend virtual environment not found. Run scripts\build.bat backend first
    exit /b 1
)

cd /d "%PROJECT_ROOT%\backend-api"
call venv\Scripts\activate.bat
pip install -r ..\tests\requirements.txt
call deactivate

echo [SUCCESS] Backend test dependencies installed
goto END

:RUN_UNIT
echo [INFO] Running unit tests...

cd /d "%PROJECT_ROOT%\backend-api"
call venv\Scripts\activate.bat

pytest tests\unit\ -v --tb=short -m "unit"

call deactivate
goto END

:RUN_INTEGRATION
echo [INFO] Running integration tests...

cd /d "%PROJECT_ROOT%\backend-api"
call venv\Scripts\activate.bat

pytest tests\integration\ -v --tb=short -m "integration"

call deactivate
goto END

:RUN_E2E
echo [INFO] Running E2E tests...

REM Check if backend is running
curl -s http://localhost:8000/health >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Backend is not running. Start it with: scripts\start.bat backend
    exit /b 1
)

cd /d "%PROJECT_ROOT%"
pytest tests\e2e\test_complete_flow.py -v --tb=short -m "e2e"

goto END

:RUN_WEBSOCKET
echo [INFO] Running WebSocket tests...

REM Check if backend is running
curl -s http://localhost:8000/health >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Backend is not running. Start it with: scripts\start.bat backend
    exit /b 1
)

cd /d "%PROJECT_ROOT%"
pytest tests\websocket\test_websocket_flow.py -v --tb=short -m "websocket"

goto END

:RUN_ALL
echo [INFO] Running all tests...

cd /d "%PROJECT_ROOT%"

REM Run unit tests
if exist "backend-api\tests\unit\test_*.py" (
    call :RUN_UNIT
    echo.
)

REM Run integration tests
if exist "backend-api\tests\integration\test_*.py" (
    call :RUN_INTEGRATION
    echo.
)

REM Run E2E tests
call :RUN_E2E
echo.

REM Run WebSocket tests
call :RUN_WEBSOCKET
echo.

goto END

:RUN_COVERAGE
echo [INFO] Generating coverage report...

cd /d "%PROJECT_ROOT%"
pytest tests\ -v --cov=backend-api\app --cov-report=html --cov-report=term-missing

echo [SUCCESS] Coverage report generated in htmlcov\index.html

REM Open coverage report in browser
start htmlcov\index.html

goto END

:END
echo.
echo [SUCCESS] Test execution completed!
cd /d "%PROJECT_ROOT%"
endlocal
