@echo off
REM ==============================================================================
REM Euralis Gaveurs System - Comprehensive Backup Script (Windows)
REM ==============================================================================
REM Purpose: Automated backup of TimescaleDB, files, and blockchain data
REM Usage: scripts\backup.bat [/DRY-RUN] [/NO-UPLOAD] [/NO-ENCRYPT]
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
set LOG_FILE=%PROJECT_ROOT%\logs\backup_%TIMESTAMP%.log

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

REM Backup options
set ENABLE_COMPRESSION=true
set ENABLE_ENCRYPTION=true
set ENCRYPTION_PASSWORD=

REM Cloud storage
set ENABLE_S3_UPLOAD=false
set S3_BUCKET=
set S3_REGION=eu-west-1

set ENABLE_AZURE_UPLOAD=false
set AZURE_STORAGE_ACCOUNT=
set AZURE_STORAGE_KEY=
set AZURE_CONTAINER=

REM Retention policy (days)
set RETAIN_DAILY=7
set RETAIN_WEEKLY=4
set RETAIN_MONTHLY=12

REM Notification
set ENABLE_EMAIL=false
set EMAIL_TO=
set EMAIL_FROM=backup@euralis-gaveurs.com

REM Flags
set DRY_RUN=false
set NO_UPLOAD=false
set NO_ENCRYPT=false

REM Load config file if exists
if exist "%CONFIG_FILE%" (
    echo Loading configuration from %CONFIG_FILE%
    call "%CONFIG_FILE%"
)

REM ==============================================================================
REM PARSE ARGUMENTS
REM ==============================================================================
:parse_args
if "%~1"=="" goto end_parse_args
if /i "%~1"=="/DRY-RUN" set DRY_RUN=true
if /i "%~1"=="/NO-UPLOAD" set NO_UPLOAD=true
if /i "%~1"=="/NO-ENCRYPT" set NO_ENCRYPT=true
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
echo   Euralis Gaveurs System - Backup Script (Windows)
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
echo Euralis Gaveurs Backup Script (Windows)
echo.
echo Usage: %~nx0 [OPTIONS]
echo.
echo Options:
echo     /DRY-RUN      Simulate backup without making changes
echo     /NO-UPLOAD    Skip cloud upload
echo     /NO-ENCRYPT   Skip encryption
echo     /HELP or /?   Show this help message
echo.
echo Configuration:
echo     Edit %CONFIG_FILE% to customize backup settings
echo.
echo Examples:
echo     %~nx0                    Normal backup
echo     %~nx0 /DRY-RUN          Test backup without changes
echo     %~nx0 /NO-UPLOAD        Backup locally only
echo     %~nx0 /NO-ENCRYPT       Backup without encryption
echo.
exit /b 0

REM ==============================================================================
REM CHECK DEPENDENCIES
REM ==============================================================================
:check_dependencies
call :log_info "Checking dependencies..."

where pg_dump >nul 2>&1
if errorlevel 1 (
    call :log_error "pg_dump not found. Install PostgreSQL client tools."
    exit /b 1
)

where 7z >nul 2>&1
if errorlevel 1 (
    call :log_warning "7-Zip not found. Compression will be disabled."
    set ENABLE_COMPRESSION=false
)

if "%ENABLE_ENCRYPTION%"=="true" if "%NO_ENCRYPT%"=="false" (
    where gpg >nul 2>&1
    if errorlevel 1 (
        call :log_warning "GPG not found. Encryption will be disabled."
        set ENABLE_ENCRYPTION=false
    )
)

if "%ENABLE_S3_UPLOAD%"=="true" if "%NO_UPLOAD%"=="false" (
    where aws >nul 2>&1
    if errorlevel 1 (
        call :log_warning "AWS CLI not found. S3 upload will be disabled."
        set ENABLE_S3_UPLOAD=false
    )
)

if "%ENABLE_AZURE_UPLOAD%"=="true" if "%NO_UPLOAD%"=="false" (
    where az >nul 2>&1
    if errorlevel 1 (
        call :log_warning "Azure CLI not found. Azure upload will be disabled."
        set ENABLE_AZURE_UPLOAD=false
    )
)

call :log_success "Dependency check completed"
exit /b 0

REM ==============================================================================
REM CREATE BACKUP DIRECTORIES
REM ==============================================================================
:create_backup_directories
set BACKUP_SUBDIR=%BACKUP_DIR%\%TIMESTAMP%

mkdir "%BACKUP_SUBDIR%\database" 2>nul
mkdir "%BACKUP_SUBDIR%\files" 2>nul
mkdir "%BACKUP_SUBDIR%\blockchain" 2>nul
mkdir "%BACKUP_SUBDIR%\logs" 2>nul

call :log_success "Backup directory created: %BACKUP_SUBDIR%"
exit /b 0

REM ==============================================================================
REM BACKUP DATABASE
REM ==============================================================================
:backup_database
call :log_info "Starting database backup..."
call :log_info "Database: %DB_NAME% on %DB_HOST%:%DB_PORT%"

set DB_BACKUP_FILE=%BACKUP_SUBDIR%\database\gaveurs_db_%TIMESTAMP%.sql

if "%DRY_RUN%"=="true" (
    call :log_warning "DRY RUN: Would backup database to %DB_BACKUP_FILE%"
    exit /b 0
)

REM Set PGPASSWORD for authentication
set PGPASSWORD=%DB_PASSWORD%

REM Backup with pg_dump
pg_dump -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -d %DB_NAME% --format=plain --verbose --no-owner --no-acl --clean --if-exists --file="%DB_BACKUP_FILE%" >> "%LOG_FILE%" 2>&1

if errorlevel 1 (
    call :log_error "Database backup failed"
    exit /b 1
)

call :log_success "Database backup completed: %DB_BACKUP_FILE%"

REM Backup schema separately
pg_dump -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -d %DB_NAME% --schema-only --file="%BACKUP_SUBDIR%\database\schema_%TIMESTAMP%.sql" >> "%LOG_FILE%" 2>&1

REM Export hypertables information
echo SELECT * FROM timescaledb_information.hypertables; | psql -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -d %DB_NAME% > "%BACKUP_SUBDIR%\database\hypertables_info_%TIMESTAMP%.txt" 2>&1

REM Export continuous aggregates
echo SELECT * FROM timescaledb_information.continuous_aggregates; | psql -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -d %DB_NAME% > "%BACKUP_SUBDIR%\database\continuous_aggregates_%TIMESTAMP%.txt" 2>&1

exit /b 0

REM ==============================================================================
REM BACKUP FILES
REM ==============================================================================
:backup_files
call :log_info "Starting files backup..."

set FILES_BACKUP=%BACKUP_SUBDIR%\files\uploaded_files_%TIMESTAMP%.zip

REM Check if upload directories exist
set HAS_FILES=false
if exist "%PROJECT_ROOT%\backend-api\uploads" set HAS_FILES=true
if exist "%PROJECT_ROOT%\backend-api\static" set HAS_FILES=true
if exist "%PROJECT_ROOT%\euralis-frontend\public\uploads" set HAS_FILES=true
if exist "%PROJECT_ROOT%\gaveurs-frontend\public\uploads" set HAS_FILES=true

if "%HAS_FILES%"=="false" (
    call :log_warning "No upload directories found, skipping files backup"
    exit /b 0
)

if "%DRY_RUN%"=="true" (
    call :log_warning "DRY RUN: Would backup files"
    exit /b 0
)

if "%ENABLE_COMPRESSION%"=="true" (
    7z a -tzip "%FILES_BACKUP%" "%PROJECT_ROOT%\backend-api\uploads" "%PROJECT_ROOT%\backend-api\static" "%PROJECT_ROOT%\euralis-frontend\public\uploads" "%PROJECT_ROOT%\gaveurs-frontend\public\uploads" -mx=5 >> "%LOG_FILE%" 2>&1

    if errorlevel 1 (
        call :log_warning "Files backup failed (non-critical)"
    ) else (
        call :log_success "Files backup completed: %FILES_BACKUP%"
    )
) else (
    call :log_info "Compression disabled, skipping files backup"
)

exit /b 0

REM ==============================================================================
REM BACKUP BLOCKCHAIN
REM ==============================================================================
:backup_blockchain
call :log_info "Starting blockchain data backup..."

set BLOCKCHAIN_BACKUP=%BACKUP_SUBDIR%\blockchain\blockchain_%TIMESTAMP%.sql

if "%DRY_RUN%"=="true" (
    call :log_warning "DRY RUN: Would backup blockchain tables"
    exit /b 0
)

set PGPASSWORD=%DB_PASSWORD%

pg_dump -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -d %DB_NAME% --table=blockchain_blocks --table=blockchain_events --table=qr_codes --table=consumer_products --table=consumer_feedbacks --format=plain --file="%BLOCKCHAIN_BACKUP%" >> "%LOG_FILE%" 2>&1

if errorlevel 1 (
    call :log_warning "Blockchain backup failed (non-critical)"
) else (
    call :log_success "Blockchain backup completed: %BLOCKCHAIN_BACKUP%"
)

exit /b 0

REM ==============================================================================
REM BACKUP LOGS
REM ==============================================================================
:backup_logs
call :log_info "Starting logs backup..."

if not exist "%PROJECT_ROOT%\logs" (
    call :log_warning "No logs directory found, skipping logs backup"
    exit /b 0
)

set LOGS_BACKUP=%BACKUP_SUBDIR%\logs\logs_%TIMESTAMP%.zip

if "%DRY_RUN%"=="true" (
    call :log_warning "DRY RUN: Would backup logs"
    exit /b 0
)

if "%ENABLE_COMPRESSION%"=="true" (
    7z a -tzip "%LOGS_BACKUP%" "%PROJECT_ROOT%\logs\*" -mx=5 >> "%LOG_FILE%" 2>&1

    if errorlevel 1 (
        call :log_warning "Logs backup failed (non-critical)"
    ) else (
        call :log_success "Logs backup completed: %LOGS_BACKUP%"
    )
)

exit /b 0

REM ==============================================================================
REM COMPRESS BACKUP
REM ==============================================================================
:compress_backup
if "%ENABLE_COMPRESSION%"=="false" (
    call :log_info "Compression disabled, skipping"
    set BACKUP_ARCHIVE=%BACKUP_SUBDIR%
    exit /b 0
)

call :log_info "Compressing backup archive..."

set BACKUP_ARCHIVE=%BACKUP_DIR%\gaveurs_backup_%TIMESTAMP%.7z

if "%DRY_RUN%"=="true" (
    call :log_warning "DRY RUN: Would compress to %BACKUP_ARCHIVE%"
    exit /b 0
)

7z a -t7z "%BACKUP_ARCHIVE%" "%BACKUP_SUBDIR%\*" -mx=9 >> "%LOG_FILE%" 2>&1

if errorlevel 1 (
    call :log_error "Compression failed"
    set BACKUP_ARCHIVE=%BACKUP_SUBDIR%
    exit /b 1
)

call :log_success "Compression completed: %BACKUP_ARCHIVE%"

REM Remove uncompressed directory
rmdir /s /q "%BACKUP_SUBDIR%"

exit /b 0

REM ==============================================================================
REM ENCRYPT BACKUP
REM ==============================================================================
:encrypt_backup
if "%ENABLE_ENCRYPTION%"=="false" goto skip_encryption
if "%NO_ENCRYPT%"=="true" goto skip_encryption
if "%ENCRYPTION_PASSWORD%"=="" goto skip_encryption

call :log_info "Encrypting backup..."

set ENCRYPTED_FILE=%BACKUP_ARCHIVE%.gpg

if "%DRY_RUN%"=="true" (
    call :log_warning "DRY RUN: Would encrypt to %ENCRYPTED_FILE%"
    exit /b 0
)

echo %ENCRYPTION_PASSWORD% | gpg --batch --yes --passphrase-fd 0 --symmetric --cipher-algo AES256 --output "%ENCRYPTED_FILE%" "%BACKUP_ARCHIVE%" >> "%LOG_FILE%" 2>&1

if errorlevel 1 (
    call :log_error "Encryption failed"
    exit /b 1
)

call :log_success "Encryption completed: %ENCRYPTED_FILE%"

REM Remove unencrypted backup
del /f /q "%BACKUP_ARCHIVE%"
set BACKUP_ARCHIVE=%ENCRYPTED_FILE%

exit /b 0

:skip_encryption
call :log_info "Encryption disabled, skipping"
exit /b 0

REM ==============================================================================
REM UPLOAD TO S3
REM ==============================================================================
:upload_to_s3
if "%ENABLE_S3_UPLOAD%"=="false" exit /b 0
if "%NO_UPLOAD%"=="true" exit /b 0
if "%S3_BUCKET%"=="" exit /b 0

call :log_info "Uploading to S3..."

if "%DRY_RUN%"=="true" (
    call :log_warning "DRY RUN: Would upload to S3"
    exit /b 0
)

aws s3 cp "%BACKUP_ARCHIVE%" "s3://%S3_BUCKET%/backups/" --region %S3_REGION% --storage-class STANDARD_IA >> "%LOG_FILE%" 2>&1

if errorlevel 1 (
    call :log_error "S3 upload failed"
    exit /b 1
)

call :log_success "S3 upload completed"
exit /b 0

REM ==============================================================================
REM UPLOAD TO AZURE
REM ==============================================================================
:upload_to_azure
if "%ENABLE_AZURE_UPLOAD%"=="false" exit /b 0
if "%NO_UPLOAD%"=="true" exit /b 0
if "%AZURE_CONTAINER%"=="" exit /b 0

call :log_info "Uploading to Azure Blob Storage..."

if "%DRY_RUN%"=="true" (
    call :log_warning "DRY RUN: Would upload to Azure"
    exit /b 0
)

az storage blob upload --account-name %AZURE_STORAGE_ACCOUNT% --account-key %AZURE_STORAGE_KEY% --container-name %AZURE_CONTAINER% --file "%BACKUP_ARCHIVE%" --name "backups/%TIMESTAMP%/%~nx" --tier Cool >> "%LOG_FILE%" 2>&1

if errorlevel 1 (
    call :log_error "Azure upload failed"
    exit /b 1
)

call :log_success "Azure upload completed"
exit /b 0

REM ==============================================================================
REM APPLY RETENTION POLICY
REM ==============================================================================
:apply_retention_policy
call :log_info "Applying retention policy..."
call :log_info "Daily: keep last %RETAIN_DAILY% days"

if "%DRY_RUN%"=="true" (
    call :log_warning "DRY RUN: Would apply retention policy"
    exit /b 0
)

REM Use PowerShell to delete old backups
powershell -Command "Get-ChildItem -Path '%BACKUP_DIR%' -Filter 'gaveurs_backup_*' | Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-%RETAIN_DAILY%) } | Remove-Item -Force" >> "%LOG_FILE%" 2>&1

call :log_success "Retention policy applied"
exit /b 0

REM ==============================================================================
REM MAIN EXECUTION
REM ==============================================================================
:main
call :check_dependencies
if errorlevel 1 exit /b 1

call :create_backup_directories
call :backup_database
if errorlevel 1 goto backup_failed
call :backup_files
call :backup_blockchain
call :backup_logs
call :compress_backup
call :encrypt_backup
call :upload_to_s3
call :upload_to_azure
call :apply_retention_policy

echo.
echo ================================================================================
call :log_success "Backup completed successfully!"
echo ================================================================================
call :log_info "Backup file: %BACKUP_ARCHIVE%"
call :log_info "Log file: %LOG_FILE%"
echo ================================================================================

exit /b 0

:backup_failed
echo.
echo ================================================================================
call :log_error "Backup failed!"
echo ================================================================================
call :log_error "Check log file: %LOG_FILE%"
echo ================================================================================
exit /b 1
