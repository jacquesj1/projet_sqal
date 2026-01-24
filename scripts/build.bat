@echo off
REM ==============================================================================
REM Build Script for Système Gaveurs V3.0 (Windows)
REM ==============================================================================
REM Usage:
REM   scripts\build.bat [all|backend|frontend-euralis|frontend-gaveurs|frontend-sqal|simulator]
REM ==============================================================================

setlocal enabledelayedexpansion

REM Project root directory
set "PROJECT_ROOT=%~dp0.."
cd /d "%PROJECT_ROOT%"

REM Default component
set "COMPONENT=%~1"
if "%COMPONENT%"=="" set "COMPONENT=all"

echo ===================================================================
echo Système Gaveurs V3.0 - Build Script (Windows)
echo ===================================================================
echo.

if "%COMPONENT%"=="all" goto BUILD_ALL
if "%COMPONENT%"=="backend" goto BUILD_BACKEND
if "%COMPONENT%"=="frontend-euralis" goto BUILD_FRONTEND_EURALIS
if "%COMPONENT%"=="frontend-gaveurs" goto BUILD_FRONTEND_GAVEURS
if "%COMPONENT%"=="frontend-sqal" goto BUILD_FRONTEND_SQAL
if "%COMPONENT%"=="simulator" goto BUILD_SIMULATOR

echo [ERROR] Unknown component: %COMPONENT%
echo.
echo Usage: %0 [all^|backend^|frontend-euralis^|frontend-gaveurs^|frontend-sqal^|simulator]
exit /b 1

:BUILD_BACKEND
echo [INFO] Building Backend (FastAPI)...
cd /d "%PROJECT_ROOT%\backend-api"

REM Check if virtual environment exists
if not exist "venv" (
    echo [WARNING] Virtual environment not found. Creating...
    python -m venv venv
    if errorlevel 1 (
        echo [ERROR] Failed to create virtual environment
        exit /b 1
    )
)

REM Activate virtual environment
call venv\Scripts\activate.bat

REM Upgrade pip
echo [INFO] Upgrading pip...
python -m pip install --upgrade pip

REM Install dependencies
echo [INFO] Installing Python dependencies...
if exist "requirements.txt" (
    pip install -r requirements.txt
    if errorlevel 1 (
        echo [ERROR] Failed to install dependencies
        exit /b 1
    )
) else (
    echo [ERROR] requirements.txt not found!
    exit /b 1
)

REM Compile Python files
echo [INFO] Compiling Python files...
python -m compileall app\ -q

call deactivate

echo [SUCCESS] Backend build completed!
if "%COMPONENT%"=="backend" goto END
goto :EOF

:BUILD_FRONTEND_EURALIS
echo [INFO] Building Frontend Euralis (Next.js)...
cd /d "%PROJECT_ROOT%\frontend"

REM Install dependencies
if not exist "node_modules" (
    echo [INFO] Installing npm dependencies...
    call npm install
    if errorlevel 1 (
        echo [ERROR] Failed to install npm dependencies
        exit /b 1
    )
) else (
    echo [INFO] Updating npm dependencies...
    call npm install
)

REM Build Next.js application
echo [INFO] Building Next.js application...
call npm run build
if errorlevel 1 (
    echo [ERROR] Failed to build Next.js application
    exit /b 1
)

echo [SUCCESS] Frontend Euralis build completed!
if "%COMPONENT%"=="frontend-euralis" goto END
goto :EOF

:BUILD_FRONTEND_GAVEURS
echo [INFO] Building Frontend Gaveurs (Next.js)...
cd /d "%PROJECT_ROOT%\gaveurs-frontend"

REM Install dependencies
if not exist "node_modules" (
    echo [INFO] Installing npm dependencies...
    call npm install
    if errorlevel 1 (
        echo [ERROR] Failed to install npm dependencies
        exit /b 1
    )
) else (
    echo [INFO] Updating npm dependencies...
    call npm install
)

REM Build Next.js application
echo [INFO] Building Next.js application...
call npm run build
if errorlevel 1 (
    echo [ERROR] Failed to build Next.js application
    exit /b 1
)

echo [SUCCESS] Frontend Gaveurs build completed!
if "%COMPONENT%"=="frontend-gaveurs" goto END
goto :EOF

:BUILD_FRONTEND_SQAL
echo [INFO] Building Frontend SQAL (React + Vite)...
cd /d "%PROJECT_ROOT%\sqal"

REM Install dependencies
if not exist "node_modules" (
    echo [INFO] Installing npm dependencies...
    call npm install
    if errorlevel 1 (
        echo [ERROR] Failed to install npm dependencies
        exit /b 1
    )
) else (
    echo [INFO] Updating npm dependencies...
    call npm install
)

REM Build Vite application
echo [INFO] Building Vite application...
call npm run build
if errorlevel 1 (
    echo [ERROR] Failed to build Vite application
    exit /b 1
)

echo [SUCCESS] Frontend SQAL build completed!
if "%COMPONENT%"=="frontend-sqal" goto END
goto :EOF

:BUILD_SIMULATOR
echo [INFO] Building Simulator SQAL...
cd /d "%PROJECT_ROOT%\simulator-sqal"

REM Check if virtual environment exists
if not exist "venv" (
    echo [WARNING] Virtual environment not found. Creating...
    python -m venv venv
    if errorlevel 1 (
        echo [ERROR] Failed to create virtual environment
        exit /b 1
    )
)

REM Activate virtual environment
call venv\Scripts\activate.bat

REM Upgrade pip
echo [INFO] Upgrading pip...
python -m pip install --upgrade pip

REM Install dependencies
echo [INFO] Installing Python dependencies...
if exist "requirements.txt" (
    pip install -r requirements.txt
) else (
    echo [WARNING] requirements.txt not found for simulator
)

REM Compile Python files
echo [INFO] Compiling Python files...
python -m compileall . -q

call deactivate

echo [SUCCESS] Simulator build completed!
if "%COMPONENT%"=="simulator" goto END
goto :EOF

:BUILD_ALL
echo [INFO] Building all components...
echo.

call :BUILD_BACKEND
echo.

call :BUILD_FRONTEND_EURALIS
echo.

call :BUILD_FRONTEND_GAVEURS
echo.

call :BUILD_FRONTEND_SQAL
echo.

call :BUILD_SIMULATOR
echo.

echo [SUCCESS] All components built successfully!
goto END

:END
echo.
echo [INFO] Build process completed at %date% %time%
cd /d "%PROJECT_ROOT%"
endlocal
