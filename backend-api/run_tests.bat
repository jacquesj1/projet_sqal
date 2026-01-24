@echo off
REM Script pour exécuter les tests backend avec pytest (Windows)
REM Usage: run_tests.bat [unit|integration|e2e|all|coverage]

echo ========================================
echo   Backend Tests - Pytest Runner
echo ========================================
echo.

REM Activate virtual environment
if exist venv\Scripts\activate.bat (
    echo Activating virtual environment...
    call venv\Scripts\activate.bat
) else (
    echo Error: Virtual environment not found
    echo Please create it with: python -m venv venv
    exit /b 1
)

REM Install test dependencies
echo Checking test dependencies...
pip install -q pytest pytest-asyncio pytest-cov httpx

REM Default to all tests
set TEST_TYPE=%1
if "%TEST_TYPE%"=="" set TEST_TYPE=all

if "%TEST_TYPE%"=="unit" (
    echo Running UNIT tests...
    echo.
    pytest tests\unit -v -m unit
    goto :end
)

if "%TEST_TYPE%"=="integration" (
    echo Running INTEGRATION tests...
    echo.
    pytest tests\integration -v -m integration
    goto :end
)

if "%TEST_TYPE%"=="e2e" (
    echo Running E2E tests...
    echo.
    pytest tests\e2e -v -m e2e
    goto :end
)

if "%TEST_TYPE%"=="blockchain" (
    echo Running BLOCKCHAIN tests...
    echo.
    pytest tests -v -m blockchain
    goto :end
)

if "%TEST_TYPE%"=="websocket" (
    echo Running WEBSOCKET tests...
    echo.
    pytest tests -v -m websocket
    goto :end
)

if "%TEST_TYPE%"=="ml" (
    echo Running ML tests...
    echo.
    pytest tests -v -m ml
    goto :end
)

if "%TEST_TYPE%"=="coverage" (
    echo Running tests with COVERAGE report...
    echo.
    pytest tests -v --cov=app --cov-report=html --cov-report=term-missing
    echo.
    echo Coverage report generated in htmlcov\index.html
    goto :end
)

if "%TEST_TYPE%"=="all" (
    echo Running ALL tests...
    echo.
    pytest tests -v
    goto :end
)

echo Error: Invalid test type
echo Usage: run_tests.bat [unit^|integration^|e2e^|blockchain^|websocket^|ml^|coverage^|all]
exit /b 1

:end
if errorlevel 1 (
    echo.
    echo ========================================
    echo   ❌ Some tests failed
    echo ========================================
    exit /b 1
) else (
    echo.
    echo ========================================
    echo   ✅ All tests passed!
    echo ========================================
)
