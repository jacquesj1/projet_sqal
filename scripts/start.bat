@echo off
REM ==============================================================================
REM Start Script for Système Gaveurs V3.0 (Windows)
REM ==============================================================================
REM Usage:
REM   scripts\start.bat [all|backend|frontend-euralis|frontend-gaveurs|frontend-sqal|simulator|db]
REM ==============================================================================

setlocal enabledelayedexpansion

REM Project root directory
set "PROJECT_ROOT=%~dp0.."
cd /d "%PROJECT_ROOT%"

REM PID file directory
set "PID_DIR=%PROJECT_ROOT%\.pids"
if not exist "%PID_DIR%" mkdir "%PID_DIR%"

REM Log directory
set "LOG_DIR=%PROJECT_ROOT%\logs"
if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"

REM Default component
set "COMPONENT=%~1"
if "%COMPONENT%"=="" set "COMPONENT=all"

echo ===================================================================
echo Système Gaveurs V3.0 - Start Script (Windows)
echo ===================================================================
echo.

if "%COMPONENT%"=="all" goto START_ALL
if "%COMPONENT%"=="db" goto START_DB
if "%COMPONENT%"=="database" goto START_DB
if "%COMPONENT%"=="backend" goto START_BACKEND
if "%COMPONENT%"=="frontend-euralis" goto START_FRONTEND_EURALIS
if "%COMPONENT%"=="frontend-gaveurs" goto START_FRONTEND_GAVEURS
if "%COMPONENT%"=="frontend-sqal" goto START_FRONTEND_SQAL
if "%COMPONENT%"=="simulator" goto START_SIMULATOR
if "%COMPONENT%"=="status" goto SHOW_STATUS

echo [ERROR] Unknown component: %COMPONENT%
echo.
echo Usage: %0 [all^|db^|backend^|frontend-euralis^|frontend-gaveurs^|frontend-sqal^|simulator^|status]
exit /b 1

:START_DB
echo [INFO] Starting TimescaleDB...

REM Check if Docker is installed
where docker >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Docker is not installed!
    exit /b 1
)

REM Check if container already exists and is running
docker ps --format "{{.Names}}" | findstr /x "gaveurs_timescaledb" >nul 2>&1
if not errorlevel 1 (
    echo [WARNING] TimescaleDB is already running
    if "%COMPONENT%"=="db" goto END
    goto :EOF
)

REM Check if container exists but is stopped
docker ps -a --format "{{.Names}}" | findstr /x "gaveurs_timescaledb" >nul 2>&1
if not errorlevel 1 (
    echo [INFO] Starting existing TimescaleDB container...
    docker start gaveurs_timescaledb
) else (
    echo [INFO] Creating new TimescaleDB container...
    docker run -d ^
        --name gaveurs_timescaledb ^
        -p 5432:5432 ^
        -e POSTGRES_DB=gaveurs_db ^
        -e POSTGRES_USER=gaveurs_admin ^
        -e POSTGRES_PASSWORD=gaveurs_secure_2024 ^
        -v gaveurs_timescaledb_data:/var/lib/postgresql/data ^
        timescale/timescaledb:latest-pg15
)

REM Wait for database to be ready
echo [INFO] Waiting for database to be ready...
for /l %%i in (1,1,30) do (
    docker exec gaveurs_timescaledb pg_isready -U gaveurs_admin >nul 2>&1
    if not errorlevel 1 (
        echo [SUCCESS] TimescaleDB is ready!
        if "%COMPONENT%"=="db" goto END
        goto :EOF
    )
    timeout /t 1 /nobreak >nul
)

echo [ERROR] TimescaleDB failed to start within 30 seconds
exit /b 1

:START_BACKEND
echo [INFO] Starting Backend (FastAPI)...

REM Check if already running
if exist "%PID_DIR%\backend.pid" (
    set /p BACKEND_PID=<"%PID_DIR%\backend.pid"
    tasklist /FI "PID eq !BACKEND_PID!" 2>nul | find "!BACKEND_PID!" >nul
    if not errorlevel 1 (
        echo [WARNING] Backend is already running (PID: !BACKEND_PID!)
        if "%COMPONENT%"=="backend" goto END
        goto :EOF
    )
)

cd /d "%PROJECT_ROOT%\backend-api"

REM Activate virtual environment and start Uvicorn
echo [INFO] Starting Uvicorn on http://localhost:8000
start /b cmd /c "call venv\Scripts\activate.bat && uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload > %LOG_DIR%\backend.log 2>&1"

REM Get PID (rough approximation)
for /f "tokens=2" %%i in ('tasklist /FI "IMAGENAME eq python.exe" /NH ^| findstr uvicorn') do (
    echo %%i > "%PID_DIR%\backend.pid"
    set "BACKEND_PID=%%i"
    goto backend_pid_found
)
:backend_pid_found

REM Wait for backend to be ready
echo [INFO] Waiting for backend to be ready...
for /l %%i in (1,1,30) do (
    curl -s http://localhost:8000/health >nul 2>&1
    if not errorlevel 1 (
        echo [SUCCESS] Backend is ready!
        if "%COMPONENT%"=="backend" goto END
        goto :EOF
    )
    timeout /t 1 /nobreak >nul
)

echo [ERROR] Backend failed to start within 30 seconds
if "%COMPONENT%"=="backend" goto END
goto :EOF

:START_FRONTEND_EURALIS
echo [INFO] Starting Frontend Euralis (Next.js)...

REM Check if already running
if exist "%PID_DIR%\frontend-euralis.pid" (
    set /p EURALIS_PID=<"%PID_DIR%\frontend-euralis.pid"
    tasklist /FI "PID eq !EURALIS_PID!" 2>nul | find "!EURALIS_PID!" >nul
    if not errorlevel 1 (
        echo [WARNING] Frontend Euralis is already running (PID: !EURALIS_PID!)
        if "%COMPONENT%"=="frontend-euralis" goto END
        goto :EOF
    )
)

cd /d "%PROJECT_ROOT%\frontend"

echo [INFO] Starting Next.js on http://localhost:3000
start /b cmd /c "npm run dev -- -p 3000 > %LOG_DIR%\frontend-euralis.log 2>&1"

REM Store approximate PID
for /f "tokens=2" %%i in ('tasklist /FI "IMAGENAME eq node.exe" /NH ^| find "node.exe"') do (
    echo %%i > "%PID_DIR%\frontend-euralis.pid"
    echo [SUCCESS] Frontend Euralis started!
    goto euralis_started
)
:euralis_started

if "%COMPONENT%"=="frontend-euralis" goto END
goto :EOF

:START_FRONTEND_GAVEURS
echo [INFO] Starting Frontend Gaveurs (Next.js)...

REM Check if already running
if exist "%PID_DIR%\frontend-gaveurs.pid" (
    set /p GAVEURS_PID=<"%PID_DIR%\frontend-gaveurs.pid"
    tasklist /FI "PID eq !GAVEURS_PID!" 2>nul | find "!GAVEURS_PID!" >nul
    if not errorlevel 1 (
        echo [WARNING] Frontend Gaveurs is already running (PID: !GAVEURS_PID!)
        if "%COMPONENT%"=="frontend-gaveurs" goto END
        goto :EOF
    )
)

cd /d "%PROJECT_ROOT%\gaveurs-frontend"

echo [INFO] Starting Next.js on http://localhost:3001
start /b cmd /c "npm run dev -- -p 3001 > %LOG_DIR%\frontend-gaveurs.log 2>&1"

REM Store approximate PID
for /f "tokens=2" %%i in ('tasklist /FI "IMAGENAME eq node.exe" /NH ^| find "node.exe"') do (
    echo %%i > "%PID_DIR%\frontend-gaveurs.pid"
    echo [SUCCESS] Frontend Gaveurs started!
    goto gaveurs_started
)
:gaveurs_started

if "%COMPONENT%"=="frontend-gaveurs" goto END
goto :EOF

:START_FRONTEND_SQAL
echo [INFO] Starting Frontend SQAL (React + Vite)...

REM Check if already running
if exist "%PID_DIR%\frontend-sqal.pid" (
    set /p SQAL_PID=<"%PID_DIR%\frontend-sqal.pid"
    tasklist /FI "PID eq !SQAL_PID!" 2>nul | find "!SQAL_PID!" >nul
    if not errorlevel 1 (
        echo [WARNING] Frontend SQAL is already running (PID: !SQAL_PID!)
        if "%COMPONENT%"=="frontend-sqal" goto END
        goto :EOF
    )
)

cd /d "%PROJECT_ROOT%\sqal"

echo [INFO] Starting Vite on http://localhost:5173
start /b cmd /c "npm run dev > %LOG_DIR%\frontend-sqal.log 2>&1"

REM Store approximate PID
for /f "tokens=2" %%i in ('tasklist /FI "IMAGENAME eq node.exe" /NH ^| find "node.exe"') do (
    echo %%i > "%PID_DIR%\frontend-sqal.pid"
    echo [SUCCESS] Frontend SQAL started!
    goto sqal_started
)
:sqal_started

if "%COMPONENT%"=="frontend-sqal" goto END
goto :EOF

:START_SIMULATOR
echo [INFO] Starting Simulator SQAL...

REM Check if already running
if exist "%PID_DIR%\simulator.pid" (
    set /p SIM_PID=<"%PID_DIR%\simulator.pid"
    tasklist /FI "PID eq !SIM_PID!" 2>nul | find "!SIM_PID!" >nul
    if not errorlevel 1 (
        echo [WARNING] Simulator is already running (PID: !SIM_PID!)
        if "%COMPONENT%"=="simulator" goto END
        goto :EOF
    )
)

cd /d "%PROJECT_ROOT%\simulator-sqal"

echo [INFO] Starting simulator with WebSocket connection
start /b cmd /c "call venv\Scripts\activate.bat && python main.py > %LOG_DIR%\simulator.log 2>&1"

REM Store approximate PID
for /f "tokens=2" %%i in ('tasklist /FI "IMAGENAME eq python.exe" /NH ^| find "python.exe"') do (
    echo %%i > "%PID_DIR%\simulator.pid"
    echo [SUCCESS] Simulator started!
    goto simulator_started
)
:simulator_started

if "%COMPONENT%"=="simulator" goto END
goto :EOF

:START_ALL
echo [INFO] Starting all components...
echo.

call :START_DB
echo.

timeout /t 2 /nobreak >nul

call :START_BACKEND
echo.

timeout /t 3 /nobreak >nul

call :START_FRONTEND_EURALIS
echo.

call :START_FRONTEND_GAVEURS
echo.

call :START_FRONTEND_SQAL
echo.

call :START_SIMULATOR
echo.

echo [SUCCESS] All components started successfully!
echo.
echo ========================================
echo Services Status:
echo ========================================
echo   [*] TimescaleDB:       http://localhost:5432
echo   [*] Backend API:       http://localhost:8000
echo   [*] API Docs:          http://localhost:8000/docs
echo   [*] Frontend Euralis:  http://localhost:3000
echo   [*] Frontend Gaveurs:  http://localhost:3001
echo   [*] Frontend SQAL:     http://localhost:5173
echo   [*] Simulator:         Running in background
echo ========================================
echo.
echo Logs are available in: %LOG_DIR%
echo To stop all services: scripts\stop.bat all
goto END

:SHOW_STATUS
echo ========================================
echo Services Status:
echo ========================================

REM Check TimescaleDB
docker ps --format "{{.Names}}" | findstr /x "gaveurs_timescaledb" >nul 2>&1
if not errorlevel 1 (
    echo   [*] TimescaleDB:       Running
) else (
    echo   [X] TimescaleDB:       Not running
)

REM Check Backend
if exist "%PID_DIR%\backend.pid" (
    set /p BACKEND_PID=<"%PID_DIR%\backend.pid"
    tasklist /FI "PID eq !BACKEND_PID!" 2>nul | find "!BACKEND_PID!" >nul
    if not errorlevel 1 (
        echo   [*] Backend:           Running (PID: !BACKEND_PID!)
    ) else (
        echo   [X] Backend:           Not running
    )
) else (
    echo   [X] Backend:           Not running
)

REM Check other services similarly...
echo ========================================
goto END

:END
echo.
echo [INFO] Start process completed at %date% %time%
cd /d "%PROJECT_ROOT%"
endlocal
