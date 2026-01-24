@echo off
REM ==============================================================================
REM Stop Script for Système Gaveurs V3.0 (Windows)
REM ==============================================================================
REM Usage:
REM   scripts\stop.bat [all|backend|frontend-euralis|frontend-gaveurs|frontend-sqal|simulator|db]
REM ==============================================================================

setlocal enabledelayedexpansion

REM Project root directory
set "PROJECT_ROOT=%~dp0.."
cd /d "%PROJECT_ROOT%"

REM PID file directory
set "PID_DIR=%PROJECT_ROOT%\.pids"

REM Default component
set "COMPONENT=%~1"
if "%COMPONENT%"=="" set "COMPONENT=all"

echo ===================================================================
echo Système Gaveurs V3.0 - Stop Script (Windows)
echo ===================================================================
echo.

if "%COMPONENT%"=="all" goto STOP_ALL
if "%COMPONENT%"=="db" goto STOP_DB
if "%COMPONENT%"=="database" goto STOP_DB
if "%COMPONENT%"=="backend" goto STOP_BACKEND
if "%COMPONENT%"=="frontend-euralis" goto STOP_FRONTEND_EURALIS
if "%COMPONENT%"=="frontend-gaveurs" goto STOP_FRONTEND_GAVEURS
if "%COMPONENT%"=="frontend-sqal" goto STOP_FRONTEND_SQAL
if "%COMPONENT%"=="simulator" goto STOP_SIMULATOR

echo [ERROR] Unknown component: %COMPONENT%
echo.
echo Usage: %0 [all^|db^|backend^|frontend-euralis^|frontend-gaveurs^|frontend-sqal^|simulator]
exit /b 1

:STOP_DB
echo [INFO] Stopping TimescaleDB...

where docker >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Docker is not installed!
    exit /b 1
)

docker ps --format "{{.Names}}" | findstr /x "gaveurs_timescaledb" >nul 2>&1
if not errorlevel 1 (
    docker stop gaveurs_timescaledb
    echo [SUCCESS] TimescaleDB stopped
) else (
    echo [WARNING] TimescaleDB is not running
)

if "%COMPONENT%"=="db" goto END
goto :EOF

:STOP_BACKEND
echo [INFO] Stopping Backend...

if not exist "%PID_DIR%\backend.pid" (
    echo [WARNING] Backend is not running (no PID file)
    if "%COMPONENT%"=="backend" goto END
    goto :EOF
)

set /p BACKEND_PID=<"%PID_DIR%\backend.pid"

tasklist /FI "PID eq %BACKEND_PID%" 2>nul | find "%BACKEND_PID%" >nul
if errorlevel 1 (
    echo [WARNING] Backend is not running (stale PID file)
    del "%PID_DIR%\backend.pid"
    if "%COMPONENT%"=="backend" goto END
    goto :EOF
)

taskkill /PID %BACKEND_PID% /F >nul 2>&1
del "%PID_DIR%\backend.pid"
echo [SUCCESS] Backend stopped

if "%COMPONENT%"=="backend" goto END
goto :EOF

:STOP_FRONTEND_EURALIS
echo [INFO] Stopping Frontend Euralis...

if not exist "%PID_DIR%\frontend-euralis.pid" (
    echo [WARNING] Frontend Euralis is not running (no PID file)
    if "%COMPONENT%"=="frontend-euralis" goto END
    goto :EOF
)

set /p EURALIS_PID=<"%PID_DIR%\frontend-euralis.pid"

tasklist /FI "PID eq %EURALIS_PID%" 2>nul | find "%EURALIS_PID%" >nul
if errorlevel 1 (
    echo [WARNING] Frontend Euralis is not running (stale PID file)
    del "%PID_DIR%\frontend-euralis.pid"
    if "%COMPONENT%"=="frontend-euralis" goto END
    goto :EOF
)

taskkill /PID %EURALIS_PID% /F /T >nul 2>&1
del "%PID_DIR%\frontend-euralis.pid"
echo [SUCCESS] Frontend Euralis stopped

if "%COMPONENT%"=="frontend-euralis" goto END
goto :EOF

:STOP_FRONTEND_GAVEURS
echo [INFO] Stopping Frontend Gaveurs...

if not exist "%PID_DIR%\frontend-gaveurs.pid" (
    echo [WARNING] Frontend Gaveurs is not running (no PID file)
    if "%COMPONENT%"=="frontend-gaveurs" goto END
    goto :EOF
)

set /p GAVEURS_PID=<"%PID_DIR%\frontend-gaveurs.pid"

tasklist /FI "PID eq %GAVEURS_PID%" 2>nul | find "%GAVEURS_PID%" >nul
if errorlevel 1 (
    echo [WARNING] Frontend Gaveurs is not running (stale PID file)
    del "%PID_DIR%\frontend-gaveurs.pid"
    if "%COMPONENT%"=="frontend-gaveurs" goto END
    goto :EOF
)

taskkill /PID %GAVEURS_PID% /F /T >nul 2>&1
del "%PID_DIR%\frontend-gaveurs.pid"
echo [SUCCESS] Frontend Gaveurs stopped

if "%COMPONENT%"=="frontend-gaveurs" goto END
goto :EOF

:STOP_FRONTEND_SQAL
echo [INFO] Stopping Frontend SQAL...

if not exist "%PID_DIR%\frontend-sqal.pid" (
    echo [WARNING] Frontend SQAL is not running (no PID file)
    if "%COMPONENT%"=="frontend-sqal" goto END
    goto :EOF
)

set /p SQAL_PID=<"%PID_DIR%\frontend-sqal.pid"

tasklist /FI "PID eq %SQAL_PID%" 2>nul | find "%SQAL_PID%" >nul
if errorlevel 1 (
    echo [WARNING] Frontend SQAL is not running (stale PID file)
    del "%PID_DIR%\frontend-sqal.pid"
    if "%COMPONENT%"=="frontend-sqal" goto END
    goto :EOF
)

taskkill /PID %SQAL_PID% /F /T >nul 2>&1
del "%PID_DIR%\frontend-sqal.pid"
echo [SUCCESS] Frontend SQAL stopped

if "%COMPONENT%"=="frontend-sqal" goto END
goto :EOF

:STOP_SIMULATOR
echo [INFO] Stopping Simulator...

if not exist "%PID_DIR%\simulator.pid" (
    echo [WARNING] Simulator is not running (no PID file)
    if "%COMPONENT%"=="simulator" goto END
    goto :EOF
)

set /p SIM_PID=<"%PID_DIR%\simulator.pid"

tasklist /FI "PID eq %SIM_PID%" 2>nul | find "%SIM_PID%" >nul
if errorlevel 1 (
    echo [WARNING] Simulator is not running (stale PID file)
    del "%PID_DIR%\simulator.pid"
    if "%COMPONENT%"=="simulator" goto END
    goto :EOF
)

taskkill /PID %SIM_PID% /F >nul 2>&1
del "%PID_DIR%\simulator.pid"
echo [SUCCESS] Simulator stopped

if "%COMPONENT%"=="simulator" goto END
goto :EOF

:STOP_ALL
echo [INFO] Stopping all components...
echo.

call :STOP_SIMULATOR
echo.

call :STOP_FRONTEND_SQAL
echo.

call :STOP_FRONTEND_GAVEURS
echo.

call :STOP_FRONTEND_EURALIS
echo.

call :STOP_BACKEND
echo.

call :STOP_DB
echo.

echo [SUCCESS] All components stopped successfully!
goto END

:END
echo.
echo [INFO] Stop process completed at %date% %time%
cd /d "%PROJECT_ROOT%"
endlocal
