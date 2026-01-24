@echo off
REM ==============================================================================
REM Euralis Gaveurs System - Comprehensive Restore Script (Windows)
REM ==============================================================================
REM Purpose: Restore TimescaleDB database, files, and blockchain data from backup
REM Usage: scripts\restore.bat [/LIST] [/BACKUP file] [/DRY-RUN] [/VERIFY]
REM Author: Euralis Gaveurs Team
REM ==============================================================================

setlocal enabledelayedexpansion

REM ==============================================================================
REM CONSTANTS & CONFIGURATION
REM ==============================================================================
set SCRIPT_DIR=%~dp0
set PROJECT_ROOT=%SCRIPT_DIR%..
set TIMESTAMP=%date:~-4,4%%date:~-10,2%%date:~-7,2%_%time:~0,2%%time:~3,2%%time:~6,2%
set TIMESTAMP=%TIMESTAMP: =0%
set LOG_FILE=%PROJECT_ROOT%\logs\restore_%TIMESTAMP%.log

REM ==============================================================================
REM LOAD CONFIGURATION
REM ==============================================================================
set CONFIG_FILE=%PROJECT_ROOT%\scripts\backup-config.env

REM Default configuration
set BACKUP_DIR=%PROJECT_ROOT%\backups
set DB_HOST=localhost
set DB_PORT=5432
set DB_NAME=gaveurs_db
set DB_USER=gaveurs_admin
set DB_PASSWORD=gaveurs_secure_2024

REM Restore options
set ENCRYPTION_PASSWORD=

REM Flags
set DRY_RUN=false
set VERIFY_ONLY=false
set LIST_BACKUPS=false
set BACKUP_FILE=
set RESTORE_DATABASE=true
set RESTORE_FILES=true
set RESTORE_BLOCKCHAIN=true
set RESTORE_LOGS=false

REM Load config file if exists
if exist "%CONFIG_FILE%" (
    call "%CONFIG_FILE%"
)

REM ==============================================================================
REM PARSE ARGUMENTS
REM ==============================================================================
:parse_args
if "%~1"=="" goto end_parse_args
if /i "%~1"=="/LIST" set LIST_BACKUPS=true
if /i "%~1"=="/DRY-RUN" set DRY_RUN=true
if /i "%~1"=="/VERIFY" set VERIFY_ONLY=true
if /i "%~1"=="/DATABASE-ONLY" (
    set RESTORE_FILES=false
    set RESTORE_BLOCKCHAIN=false
    set RESTORE_LOGS=false
)
if /i "%~1"=="/BACKUP" (
    set BACKUP_FILE=%~2
    shift
)
if /i "%~1"=="/?" goto show_help
if /i "%~1"=="/HELP" goto show_help
shift
goto parse_args
:end_parse_args

REM ==============================================================================
REM LOGGING FUNCTIONS
REM ==============================================================================
mkdir "%PROJECT_ROOT%\logs" 2>nul

call :log_header
goto main

:log_header
echo ================================================================================
echo   Euralis Gaveurs System - Restore Script (Windows)
echo ================================================================================
echo   Timestamp: %TIMESTAMP%
echo   Log file: %LOG_FILE%
echo ================================================================================
echo.
exit /b

:log_info
echo [INFO] %* | tee -a "%LOG_FILE%"
exit /b

:log_success
echo [SUCCESS] %* | tee -a "%LOG_FILE%"
exit /b

:log_warning
echo [WARNING] %* | tee -a "%LOG_FILE%"
exit /b

:log_error
echo [ERROR] %* | tee -a "%LOG_FILE%"
exit /b

:show_help
echo Euralis Gaveurs Restore Script (Windows)
echo.
echo Usage: %~nx0 [OPTIONS]
echo.
echo Options:
echo     /LIST             List available backups
echo     /BACKUP file      Restore from specific backup file
echo     /DRY-RUN          Simulate restore without making changes
echo     /VERIFY           Verify restore without restoring
echo     /DATABASE-ONLY    Restore only database (skip files/blockchain)
echo     /HELP or /?       Show this help message
echo.
echo Examples:
echo     %~nx0 /LIST                                 List available backups
echo     %~nx0                                       Interactive restore
echo     %~nx0 /BACKUP backups\gaveurs_backup.7z    Restore from file
echo     %~nx0 /DRY-RUN                             Test restore
echo     %~nx0 /VERIFY                              Verify current database
echo     %~nx0 /DATABASE-ONLY                       Restore database only
echo.
exit /b 0

:confirm_action
set /p CONFIRM="Are you sure you want to continue? [y/N] "
if /i not "%CONFIRM%"=="y" (
    call :log_warning "Operation cancelled by user"
    exit /b 1
)
exit /b 0

REM ==============================================================================
REM CHECK DEPENDENCIES
REM ==============================================================================
:check_dependencies
call :log_info "Checking dependencies..."

where psql >nul 2>&1
if errorlevel 1 (
    call :log_error "psql not found. Install PostgreSQL client tools."
    exit /b 1
)

where 7z >nul 2>&1
if errorlevel 1 (
    call :log_error "7-Zip not found. Please install 7-Zip."
    exit /b 1
)

call :log_success "All dependencies satisfied"
exit /b 0

REM ==============================================================================
REM LIST BACKUPS
REM ==============================================================================
:list_backups
call :log_info "Available backups in %BACKUP_DIR%:"
echo.
echo ================================================================================
echo.

if not exist "%BACKUP_DIR%" (
    call :log_warning "Backup directory not found: %BACKUP_DIR%"
    exit /b 1
)

set COUNT=0
for %%F in ("%BACKUP_DIR%\gaveurs_backup_*.*") do (
    set /a COUNT+=1
    echo !COUNT!. %%~nxF
)

if %COUNT%==0 (
    call :log_warning "No backups found"
    exit /b 1
)

echo.
echo ================================================================================
exit /b 0

REM ==============================================================================
REM SELECT BACKUP
REM ==============================================================================
:select_backup
if not "%BACKUP_FILE%"=="" (
    if not exist "%BACKUP_FILE%" (
        call :log_error "Backup file not found: %BACKUP_FILE%"
        exit /b 1
    )
    exit /b 0
)

call :list_backups

echo.
set /p SELECTION="Select backup number (or 'q' to quit): "

if /i "%SELECTION%"=="q" (
    call :log_info "Operation cancelled"
    exit /b 1
)

set COUNT=0
for %%F in ("%BACKUP_DIR%\gaveurs_backup_*.*") do (
    set /a COUNT+=1
    if !COUNT!==%SELECTION% (
        set BACKUP_FILE=%%F
        call :log_info "Selected backup: %%~nxF"
        exit /b 0
    )
)

call :log_error "Invalid selection"
exit /b 1

REM ==============================================================================
REM DECRYPT BACKUP
REM ==============================================================================
:decrypt_backup
set INPUT_FILE=%~1
set OUTPUT_FILE=%INPUT_FILE:.gpg=%

REM Check if file is encrypted
echo %INPUT_FILE% | findstr /i ".gpg" >nul
if errorlevel 1 (
    set DECRYPTED_FILE=%INPUT_FILE%
    exit /b 0
)

call :log_info "Decrypting backup..."

if "%ENCRYPTION_PASSWORD%"=="" (
    set /p ENCRYPTION_PASSWORD="Enter decryption password: "
)

if "%DRY_RUN%"=="true" (
    call :log_warning "DRY RUN: Would decrypt %INPUT_FILE%"
    set DECRYPTED_FILE=%OUTPUT_FILE%
    exit /b 0
)

echo %ENCRYPTION_PASSWORD% | gpg --batch --yes --passphrase-fd 0 --decrypt --output "%OUTPUT_FILE%" "%INPUT_FILE%" >> "%LOG_FILE%" 2>&1

if errorlevel 1 (
    call :log_error "Decryption failed"
    exit /b 1
)

call :log_success "Decryption completed: %OUTPUT_FILE%"
set DECRYPTED_FILE=%OUTPUT_FILE%
exit /b 0

REM ==============================================================================
REM EXTRACT BACKUP
REM ==============================================================================
:extract_backup
set INPUT_FILE=%~1
set EXTRACT_DIR=%BACKUP_DIR%\restore_%TIMESTAMP%

call :log_info "Extracting backup archive..."

mkdir "%EXTRACT_DIR%" 2>nul

if "%DRY_RUN%"=="true" (
    call :log_warning "DRY RUN: Would extract %INPUT_FILE%"
    exit /b 0
)

7z x "%INPUT_FILE%" -o"%EXTRACT_DIR%" >> "%LOG_FILE%" 2>&1

if errorlevel 1 (
    call :log_error "Extraction failed"
    exit /b 1
)

call :log_success "Extraction completed: %EXTRACT_DIR%"
exit /b 0

REM ==============================================================================
REM RESTORE DATABASE
REM ==============================================================================
:restore_database
call :log_info "Restoring database..."

REM Find database backup file
set DB_BACKUP_FILE=
for /r "%EXTRACT_DIR%" %%F in (gaveurs_db_*.sql) do (
    set DB_BACKUP_FILE=%%F
    goto found_db
)

:found_db
if "%DB_BACKUP_FILE%"=="" (
    call :log_error "Database backup file not found"
    exit /b 1
)

call :log_info "Database backup: %DB_BACKUP_FILE%"

echo WARNING: This will DROP and recreate the database '%DB_NAME%'.
echo All existing data will be lost!
call :confirm_action
if errorlevel 1 exit /b 1

if "%DRY_RUN%"=="true" (
    call :log_warning "DRY RUN: Would restore database from %DB_BACKUP_FILE%"
    exit /b 0
)

REM Set password
set PGPASSWORD=%DB_PASSWORD%

REM Terminate existing connections
call :log_info "Terminating existing database connections..."
echo SELECT pg_terminate_backend(pg_stat_activity.pid) FROM pg_stat_activity WHERE pg_stat_activity.datname = '%DB_NAME%' AND pid ^<^> pg_backend_pid(); | psql -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -d postgres >> "%LOG_FILE%" 2>&1

REM Restore database
call :log_info "Restoring database..."
psql -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -d postgres -f "%DB_BACKUP_FILE%" >> "%LOG_FILE%" 2>&1

if errorlevel 1 (
    call :log_error "Database restore failed"
    exit /b 1
)

call :log_success "Database restore completed"

REM Verify TimescaleDB
call :log_info "Verifying TimescaleDB extension..."
echo SELECT * FROM timescaledb_information.hypertables; | psql -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -d %DB_NAME% >> "%LOG_FILE%" 2>&1

exit /b 0

REM ==============================================================================
REM RESTORE FILES
REM ==============================================================================
:restore_files
call :log_info "Restoring files..."

set FILES_BACKUP=
for /r "%EXTRACT_DIR%" %%F in (uploaded_files_*.zip) do (
    set FILES_BACKUP=%%F
    goto found_files
)

:found_files
if "%FILES_BACKUP%"=="" (
    call :log_warning "Files backup not found, skipping"
    exit /b 0
)

echo WARNING: This will overwrite existing uploaded files!
call :confirm_action
if errorlevel 1 exit /b 0

if "%DRY_RUN%"=="true" (
    call :log_warning "DRY RUN: Would restore files from %FILES_BACKUP%"
    exit /b 0
)

7z x "%FILES_BACKUP%" -o"%PROJECT_ROOT%" -aoa >> "%LOG_FILE%" 2>&1

if errorlevel 1 (
    call :log_error "Files restore failed"
    exit /b 1
)

call :log_success "Files restore completed"
exit /b 0

REM ==============================================================================
REM RESTORE BLOCKCHAIN
REM ==============================================================================
:restore_blockchain
call :log_info "Restoring blockchain data..."

set BLOCKCHAIN_BACKUP=
for /r "%EXTRACT_DIR%" %%F in (blockchain_*.sql) do (
    set BLOCKCHAIN_BACKUP=%%F
    goto found_blockchain
)

:found_blockchain
if "%BLOCKCHAIN_BACKUP%"=="" (
    call :log_warning "Blockchain backup not found, skipping"
    exit /b 0
)

if "%DRY_RUN%"=="true" (
    call :log_warning "DRY RUN: Would restore blockchain from %BLOCKCHAIN_BACKUP%"
    exit /b 0
)

set PGPASSWORD=%DB_PASSWORD%

psql -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -d %DB_NAME% -f "%BLOCKCHAIN_BACKUP%" >> "%LOG_FILE%" 2>&1

if errorlevel 1 (
    call :log_error "Blockchain restore failed"
    exit /b 1
)

call :log_success "Blockchain restore completed"
exit /b 0

REM ==============================================================================
REM VERIFY RESTORE
REM ==============================================================================
:verify_restore
call :log_info "Verifying restored database..."

set PGPASSWORD=%DB_PASSWORD%

set CHECKS_PASSED=0
set CHECKS_FAILED=0

REM Check database connection
echo SELECT 1; | psql -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -d %DB_NAME% >nul 2>&1
if errorlevel 1 (
    call :log_error "Database connection: FAILED"
    set /a CHECKS_FAILED+=1
) else (
    call :log_success "Database connection: OK"
    set /a CHECKS_PASSED+=1
)

REM Check TimescaleDB extension
for /f %%i in ('echo SELECT COUNT(*) FROM pg_extension WHERE extname='timescaledb'; ^| psql -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -d %DB_NAME% -t 2^>nul') do set TIMESCALE_COUNT=%%i
if "%TIMESCALE_COUNT%"=="1" (
    call :log_success "TimescaleDB extension: OK"
    set /a CHECKS_PASSED+=1
) else (
    call :log_error "TimescaleDB extension: NOT INSTALLED"
    set /a CHECKS_FAILED+=1
)

REM Check key tables
for %%T in (gaveurs canards gavage_data sites_euralis lots_gavage) do (
    for /f %%i in ('echo SELECT COUNT(*) FROM %%T; ^| psql -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -d %DB_NAME% -t 2^>nul') do (
        call :log_success "Table %%T: %%i rows"
        set /a CHECKS_PASSED+=1
    )
)

echo.
echo ================================================================================
call :log_info "Verification Summary: %CHECKS_PASSED% passed, %CHECKS_FAILED% failed"
echo ================================================================================

exit /b %CHECKS_FAILED%

REM ==============================================================================
REM MAIN EXECUTION
REM ==============================================================================
:main
if "%LIST_BACKUPS%"=="true" (
    call :list_backups
    exit /b 0
)

if "%VERIFY_ONLY%"=="true" (
    call :verify_restore
    exit /b
)

call :check_dependencies
if errorlevel 1 exit /b 1

call :select_backup
if errorlevel 1 exit /b 1

call :decrypt_backup "%BACKUP_FILE%"
if errorlevel 1 exit /b 1

call :extract_backup "%DECRYPTED_FILE%"
if errorlevel 1 exit /b 1

set RESTORE_STATUS=0

if "%RESTORE_DATABASE%"=="true" (
    call :restore_database
    if errorlevel 1 set RESTORE_STATUS=1
)

if "%RESTORE_FILES%"=="true" (
    call :restore_files
    if errorlevel 1 set RESTORE_STATUS=1
)

if "%RESTORE_BLOCKCHAIN%"=="true" (
    call :restore_blockchain
    if errorlevel 1 set RESTORE_STATUS=1
)

call :verify_restore

REM Cleanup
if not "%DRY_RUN%"=="true" (
    call :log_info "Cleaning up temporary files..."
    rmdir /s /q "%EXTRACT_DIR%" 2>nul
    if not "%DECRYPTED_FILE%"=="%BACKUP_FILE%" (
        del /f /q "%DECRYPTED_FILE%" 2>nul
    )
)

echo.
echo ================================================================================
if %RESTORE_STATUS%==0 (
    call :log_success "Restore completed successfully!"
) else (
    call :log_error "Restore completed with errors!"
)
echo ================================================================================
call :log_info "Log file: %LOG_FILE%"
echo ================================================================================

exit /b %RESTORE_STATUS%
