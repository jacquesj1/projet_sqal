#!/bin/bash
# ==============================================================================
# Euralis Gaveurs System - Comprehensive Backup Script
# ==============================================================================
# Purpose: Automated backup of TimescaleDB, files, and blockchain data
# Usage: ./scripts/backup.sh [--dry-run] [--no-upload] [--no-encrypt]
# Author: Euralis Gaveurs Team
# ==============================================================================

set -euo pipefail
IFS=$'\n\t'

# ==============================================================================
# CONSTANTS & COLORS
# ==============================================================================
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
readonly TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
readonly LOG_FILE="${PROJECT_ROOT}/logs/backup_${TIMESTAMP}.log"

# Colors for output
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly NC='\033[0m' # No Color

# ==============================================================================
# CONFIGURATION LOADING
# ==============================================================================
CONFIG_FILE="${PROJECT_ROOT}/scripts/backup-config.env"

# Default configuration
BACKUP_DIR="${PROJECT_ROOT}/backups"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-gaveurs_db}"
DB_USER="${DB_USER:-gaveurs_admin}"
DB_PASSWORD="${DB_PASSWORD:-gaveurs_secure_2024}"

# Backup options
ENABLE_COMPRESSION="${ENABLE_COMPRESSION:-true}"
ENABLE_ENCRYPTION="${ENABLE_ENCRYPTION:-true}"
ENCRYPTION_PASSWORD="${ENCRYPTION_PASSWORD:-}"

# Cloud storage
ENABLE_S3_UPLOAD="${ENABLE_S3_UPLOAD:-false}"
S3_BUCKET="${S3_BUCKET:-}"
S3_REGION="${S3_REGION:-eu-west-1}"
AWS_ACCESS_KEY_ID="${AWS_ACCESS_KEY_ID:-}"
AWS_SECRET_ACCESS_KEY="${AWS_SECRET_ACCESS_KEY:-}"

ENABLE_AZURE_UPLOAD="${ENABLE_AZURE_UPLOAD:-false}"
AZURE_STORAGE_ACCOUNT="${AZURE_STORAGE_ACCOUNT:-}"
AZURE_STORAGE_KEY="${AZURE_STORAGE_KEY:-}"
AZURE_CONTAINER="${AZURE_CONTAINER:-}"

# Retention policy (days)
RETAIN_DAILY="${RETAIN_DAILY:-7}"
RETAIN_WEEKLY="${RETAIN_WEEKLY:-4}"
RETAIN_MONTHLY="${RETAIN_MONTHLY:-12}"

# Notification
ENABLE_EMAIL="${ENABLE_EMAIL:-false}"
EMAIL_TO="${EMAIL_TO:-}"
EMAIL_FROM="${EMAIL_FROM:-backup@euralis-gaveurs.com}"
SMTP_HOST="${SMTP_HOST:-localhost}"
SMTP_PORT="${SMTP_PORT:-25}"

ENABLE_SLACK="${ENABLE_SLACK:-false}"
SLACK_WEBHOOK_URL="${SLACK_WEBHOOK_URL:-}"

# Flags
DRY_RUN=false
NO_UPLOAD=false
NO_ENCRYPT=false

# ==============================================================================
# LOGGING FUNCTIONS
# ==============================================================================
log() {
    local level=$1
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    local log_entry="[${timestamp}] [${level}] ${message}"

    echo -e "${log_entry}" | tee -a "$LOG_FILE"
}

log_info() {
    echo -e "${BLUE}[INFO]${NC} $*" | tee -a "$LOG_FILE"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $*" | tee -a "$LOG_FILE"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $*" | tee -a "$LOG_FILE"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $*" | tee -a "$LOG_FILE"
}

# ==============================================================================
# HELPER FUNCTIONS
# ==============================================================================
check_command() {
    if ! command -v "$1" &> /dev/null; then
        log_error "$1 is not installed. Please install it first."
        return 1
    fi
    return 0
}

check_dependencies() {
    log_info "Checking dependencies..."

    local missing_deps=()

    check_command pg_dump || missing_deps+=("postgresql-client")
    check_command tar || missing_deps+=("tar")

    if [[ "$ENABLE_ENCRYPTION" == "true" && "$NO_ENCRYPT" == "false" ]]; then
        check_command gpg || missing_deps+=("gnupg")
    fi

    if [[ "$ENABLE_S3_UPLOAD" == "true" && "$NO_UPLOAD" == "false" ]]; then
        check_command aws || missing_deps+=("awscli")
    fi

    if [[ "$ENABLE_AZURE_UPLOAD" == "true" && "$NO_UPLOAD" == "false" ]]; then
        check_command az || missing_deps+=("azure-cli")
    fi

    if [[ ${#missing_deps[@]} -gt 0 ]]; then
        log_error "Missing dependencies: ${missing_deps[*]}"
        log_info "Install with: sudo apt-get install ${missing_deps[*]}"
        return 1
    fi

    log_success "All dependencies satisfied"
    return 0
}

create_backup_directories() {
    local backup_subdir="${BACKUP_DIR}/${TIMESTAMP}"

    mkdir -p "$backup_subdir"/{database,files,blockchain,logs}
    mkdir -p "${PROJECT_ROOT}/logs"

    echo "$backup_subdir"
}

get_database_size() {
    PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c \
        "SELECT pg_size_pretty(pg_database_size('$DB_NAME'));" 2>/dev/null | xargs || echo "Unknown"
}

# ==============================================================================
# BACKUP FUNCTIONS
# ==============================================================================
backup_database() {
    local backup_dir=$1
    local db_backup_file="${backup_dir}/database/gaveurs_db_${TIMESTAMP}.sql"

    log_info "Starting database backup..."
    log_info "Database: ${DB_NAME} on ${DB_HOST}:${DB_PORT}"
    log_info "Size: $(get_database_size)"

    if [[ "$DRY_RUN" == "true" ]]; then
        log_warning "DRY RUN: Would backup database to $db_backup_file"
        return 0
    fi

    # Backup with pg_dump (includes TimescaleDB hypertables)
    PGPASSWORD="$DB_PASSWORD" pg_dump \
        -h "$DB_HOST" \
        -p "$DB_PORT" \
        -U "$DB_USER" \
        -d "$DB_NAME" \
        --format=plain \
        --verbose \
        --no-owner \
        --no-acl \
        --clean \
        --if-exists \
        --file="$db_backup_file" 2>&1 | tee -a "$LOG_FILE"

    if [[ $? -eq 0 ]]; then
        local size=$(du -h "$db_backup_file" | cut -f1)
        log_success "Database backup completed: $db_backup_file ($size)"

        # Backup database schema separately for quick reference
        PGPASSWORD="$DB_PASSWORD" pg_dump \
            -h "$DB_HOST" \
            -p "$DB_PORT" \
            -U "$DB_USER" \
            -d "$DB_NAME" \
            --schema-only \
            --file="${backup_dir}/database/schema_${TIMESTAMP}.sql" 2>&1 | tee -a "$LOG_FILE"

        # Export hypertables information
        PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
            -c "SELECT * FROM timescaledb_information.hypertables;" \
            > "${backup_dir}/database/hypertables_info_${TIMESTAMP}.txt" 2>&1 | tee -a "$LOG_FILE"

        # Export continuous aggregates information
        PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
            -c "SELECT * FROM timescaledb_information.continuous_aggregates;" \
            > "${backup_dir}/database/continuous_aggregates_${TIMESTAMP}.txt" 2>&1 | tee -a "$LOG_FILE"

        return 0
    else
        log_error "Database backup failed"
        return 1
    fi
}

backup_files() {
    local backup_dir=$1
    local files_backup="${backup_dir}/files/uploaded_files_${TIMESTAMP}.tar"

    log_info "Starting files backup..."

    # Directories to backup
    local upload_dirs=(
        "${PROJECT_ROOT}/backend-api/uploads"
        "${PROJECT_ROOT}/backend-api/static"
        "${PROJECT_ROOT}/euralis-frontend/public/uploads"
        "${PROJECT_ROOT}/gaveurs-frontend/public/uploads"
    )

    local existing_dirs=()
    for dir in "${upload_dirs[@]}"; do
        if [[ -d "$dir" ]]; then
            existing_dirs+=("$dir")
        fi
    done

    if [[ ${#existing_dirs[@]} -eq 0 ]]; then
        log_warning "No upload directories found, skipping files backup"
        return 0
    fi

    if [[ "$DRY_RUN" == "true" ]]; then
        log_warning "DRY RUN: Would backup files from: ${existing_dirs[*]}"
        return 0
    fi

    tar -czf "$files_backup.gz" "${existing_dirs[@]}" 2>&1 | tee -a "$LOG_FILE"

    if [[ $? -eq 0 ]]; then
        local size=$(du -h "$files_backup.gz" | cut -f1)
        log_success "Files backup completed: $files_backup.gz ($size)"
        return 0
    else
        log_warning "Files backup failed (non-critical)"
        return 0
    fi
}

backup_blockchain() {
    local backup_dir=$1
    local blockchain_backup="${backup_dir}/blockchain/blockchain_${TIMESTAMP}.sql"

    log_info "Starting blockchain data backup..."

    if [[ "$DRY_RUN" == "true" ]]; then
        log_warning "DRY RUN: Would backup blockchain tables"
        return 0
    fi

    # Backup blockchain-specific tables
    PGPASSWORD="$DB_PASSWORD" pg_dump \
        -h "$DB_HOST" \
        -p "$DB_PORT" \
        -U "$DB_USER" \
        -d "$DB_NAME" \
        --table=blockchain_blocks \
        --table=blockchain_events \
        --table=qr_codes \
        --table=consumer_products \
        --table=consumer_feedbacks \
        --format=plain \
        --file="$blockchain_backup" 2>&1 | tee -a "$LOG_FILE"

    if [[ $? -eq 0 ]]; then
        local size=$(du -h "$blockchain_backup" | cut -f1)
        log_success "Blockchain backup completed: $blockchain_backup ($size)"
        return 0
    else
        log_warning "Blockchain backup failed (non-critical)"
        return 0
    fi
}

backup_logs() {
    local backup_dir=$1
    local logs_backup="${backup_dir}/logs/logs_${TIMESTAMP}.tar.gz"

    log_info "Starting logs backup..."

    if [[ ! -d "${PROJECT_ROOT}/logs" ]]; then
        log_warning "No logs directory found, skipping logs backup"
        return 0
    fi

    if [[ "$DRY_RUN" == "true" ]]; then
        log_warning "DRY RUN: Would backup logs"
        return 0
    fi

    tar -czf "$logs_backup" -C "${PROJECT_ROOT}" logs/ 2>&1 | tee -a "$LOG_FILE"

    if [[ $? -eq 0 ]]; then
        local size=$(du -h "$logs_backup" | cut -f1)
        log_success "Logs backup completed: $logs_backup ($size)"
        return 0
    else
        log_warning "Logs backup failed (non-critical)"
        return 0
    fi
}

compress_backup() {
    local backup_dir=$1
    local archive_name="${BACKUP_DIR}/gaveurs_backup_${TIMESTAMP}.tar.gz"

    if [[ "$ENABLE_COMPRESSION" != "true" ]]; then
        log_info "Compression disabled, skipping"
        echo "$backup_dir"
        return 0
    fi

    log_info "Compressing backup archive..."

    if [[ "$DRY_RUN" == "true" ]]; then
        log_warning "DRY RUN: Would compress to $archive_name"
        echo "$archive_name"
        return 0
    fi

    tar -czf "$archive_name" -C "$BACKUP_DIR" "$(basename "$backup_dir")" 2>&1 | tee -a "$LOG_FILE"

    if [[ $? -eq 0 ]]; then
        local size=$(du -h "$archive_name" | cut -f1)
        log_success "Compression completed: $archive_name ($size)"

        # Remove uncompressed backup directory
        rm -rf "$backup_dir"

        echo "$archive_name"
        return 0
    else
        log_error "Compression failed"
        echo "$backup_dir"
        return 1
    fi
}

encrypt_backup() {
    local backup_file=$1

    if [[ "$ENABLE_ENCRYPTION" != "true" || "$NO_ENCRYPT" == "true" ]]; then
        log_info "Encryption disabled, skipping"
        echo "$backup_file"
        return 0
    fi

    if [[ -z "$ENCRYPTION_PASSWORD" ]]; then
        log_warning "No encryption password set, skipping encryption"
        echo "$backup_file"
        return 0
    fi

    log_info "Encrypting backup..."

    local encrypted_file="${backup_file}.gpg"

    if [[ "$DRY_RUN" == "true" ]]; then
        log_warning "DRY RUN: Would encrypt to $encrypted_file"
        echo "$encrypted_file"
        return 0
    fi

    echo "$ENCRYPTION_PASSWORD" | gpg \
        --batch \
        --yes \
        --passphrase-fd 0 \
        --symmetric \
        --cipher-algo AES256 \
        --output "$encrypted_file" \
        "$backup_file" 2>&1 | tee -a "$LOG_FILE"

    if [[ $? -eq 0 ]]; then
        local size=$(du -h "$encrypted_file" | cut -f1)
        log_success "Encryption completed: $encrypted_file ($size)"

        # Remove unencrypted backup
        rm -f "$backup_file"

        echo "$encrypted_file"
        return 0
    else
        log_error "Encryption failed"
        echo "$backup_file"
        return 1
    fi
}

# ==============================================================================
# CLOUD UPLOAD FUNCTIONS
# ==============================================================================
upload_to_s3() {
    local backup_file=$1

    if [[ "$ENABLE_S3_UPLOAD" != "true" || "$NO_UPLOAD" == "true" ]]; then
        return 0
    fi

    if [[ -z "$S3_BUCKET" ]]; then
        log_warning "S3 bucket not configured, skipping S3 upload"
        return 0
    fi

    log_info "Uploading to S3: s3://${S3_BUCKET}/backups/$(basename "$backup_file")"

    if [[ "$DRY_RUN" == "true" ]]; then
        log_warning "DRY RUN: Would upload to S3"
        return 0
    fi

    aws s3 cp \
        "$backup_file" \
        "s3://${S3_BUCKET}/backups/$(basename "$backup_file")" \
        --region "$S3_REGION" \
        --storage-class STANDARD_IA 2>&1 | tee -a "$LOG_FILE"

    if [[ $? -eq 0 ]]; then
        log_success "S3 upload completed"
        return 0
    else
        log_error "S3 upload failed"
        return 1
    fi
}

upload_to_azure() {
    local backup_file=$1

    if [[ "$ENABLE_AZURE_UPLOAD" != "true" || "$NO_UPLOAD" == "true" ]]; then
        return 0
    fi

    if [[ -z "$AZURE_CONTAINER" ]]; then
        log_warning "Azure container not configured, skipping Azure upload"
        return 0
    fi

    log_info "Uploading to Azure Blob Storage: ${AZURE_CONTAINER}/backups/$(basename "$backup_file")"

    if [[ "$DRY_RUN" == "true" ]]; then
        log_warning "DRY RUN: Would upload to Azure"
        return 0
    fi

    az storage blob upload \
        --account-name "$AZURE_STORAGE_ACCOUNT" \
        --account-key "$AZURE_STORAGE_KEY" \
        --container-name "$AZURE_CONTAINER" \
        --file "$backup_file" \
        --name "backups/$(basename "$backup_file")" \
        --tier Cool 2>&1 | tee -a "$LOG_FILE"

    if [[ $? -eq 0 ]]; then
        log_success "Azure upload completed"
        return 0
    else
        log_error "Azure upload failed"
        return 1
    fi
}

# ==============================================================================
# RETENTION POLICY
# ==============================================================================
apply_retention_policy() {
    log_info "Applying retention policy..."
    log_info "Daily: keep last ${RETAIN_DAILY} days"
    log_info "Weekly: keep last ${RETAIN_WEEKLY} weeks"
    log_info "Monthly: keep last ${RETAIN_MONTHLY} months"

    if [[ "$DRY_RUN" == "true" ]]; then
        log_warning "DRY RUN: Would apply retention policy"
        return 0
    fi

    # Remove daily backups older than RETAIN_DAILY days
    find "$BACKUP_DIR" -name "gaveurs_backup_*.tar.gz*" -type f -mtime "+${RETAIN_DAILY}" -delete 2>&1 | tee -a "$LOG_FILE"

    log_success "Retention policy applied"
}

# ==============================================================================
# NOTIFICATION FUNCTIONS
# ==============================================================================
send_email_notification() {
    local status=$1
    local backup_file=$2

    if [[ "$ENABLE_EMAIL" != "true" ]]; then
        return 0
    fi

    if [[ -z "$EMAIL_TO" ]]; then
        log_warning "Email recipient not configured"
        return 0
    fi

    local subject
    local body

    if [[ "$status" == "success" ]]; then
        subject="✅ Euralis Gaveurs Backup Successful - $TIMESTAMP"
        body="Backup completed successfully.\n\nFile: $(basename "$backup_file")\nSize: $(du -h "$backup_file" 2>/dev/null | cut -f1 || echo 'N/A')\nTimestamp: $TIMESTAMP"
    else
        subject="❌ Euralis Gaveurs Backup Failed - $TIMESTAMP"
        body="Backup failed. Please check logs at $LOG_FILE"
    fi

    if [[ "$DRY_RUN" == "true" ]]; then
        log_warning "DRY RUN: Would send email to $EMAIL_TO"
        return 0
    fi

    echo -e "$body" | mail -s "$subject" -r "$EMAIL_FROM" "$EMAIL_TO" 2>&1 | tee -a "$LOG_FILE"

    if [[ $? -eq 0 ]]; then
        log_success "Email notification sent"
    else
        log_warning "Failed to send email notification"
    fi
}

send_slack_notification() {
    local status=$1
    local backup_file=$2

    if [[ "$ENABLE_SLACK" != "true" ]]; then
        return 0
    fi

    if [[ -z "$SLACK_WEBHOOK_URL" ]]; then
        log_warning "Slack webhook URL not configured"
        return 0
    fi

    local color
    local emoji
    local text

    if [[ "$status" == "success" ]]; then
        color="good"
        emoji=":white_check_mark:"
        text="Backup completed successfully"
    else
        color="danger"
        emoji=":x:"
        text="Backup failed"
    fi

    local payload=$(cat <<EOF
{
    "attachments": [{
        "color": "$color",
        "title": "$emoji Euralis Gaveurs Backup - $status",
        "text": "$text",
        "fields": [
            {
                "title": "Timestamp",
                "value": "$TIMESTAMP",
                "short": true
            },
            {
                "title": "File",
                "value": "$(basename "$backup_file" 2>/dev/null || echo 'N/A')",
                "short": true
            }
        ]
    }]
}
EOF
)

    if [[ "$DRY_RUN" == "true" ]]; then
        log_warning "DRY RUN: Would send Slack notification"
        return 0
    fi

    curl -X POST -H 'Content-type: application/json' --data "$payload" "$SLACK_WEBHOOK_URL" 2>&1 | tee -a "$LOG_FILE"

    if [[ $? -eq 0 ]]; then
        log_success "Slack notification sent"
    else
        log_warning "Failed to send Slack notification"
    fi
}

# ==============================================================================
# MAIN EXECUTION
# ==============================================================================
parse_arguments() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --dry-run)
                DRY_RUN=true
                shift
                ;;
            --no-upload)
                NO_UPLOAD=true
                shift
                ;;
            --no-encrypt)
                NO_ENCRYPT=true
                shift
                ;;
            --help)
                cat <<EOF
Euralis Gaveurs Backup Script

Usage: $0 [OPTIONS]

Options:
    --dry-run       Simulate backup without making changes
    --no-upload     Skip cloud upload
    --no-encrypt    Skip encryption
    --help          Show this help message

Configuration:
    Edit ${CONFIG_FILE} to customize backup settings

Examples:
    $0                      # Normal backup
    $0 --dry-run            # Test backup without changes
    $0 --no-upload          # Backup locally only
    $0 --no-encrypt         # Backup without encryption

EOF
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                exit 1
                ;;
        esac
    done
}

main() {
    echo "================================================================================"
    echo "  Euralis Gaveurs System - Backup Script"
    echo "================================================================================"
    echo "  Timestamp: $TIMESTAMP"
    echo "  Log file: $LOG_FILE"
    echo "================================================================================"
    echo ""

    # Parse command line arguments
    parse_arguments "$@"

    # Load configuration file if exists
    if [[ -f "$CONFIG_FILE" ]]; then
        log_info "Loading configuration from $CONFIG_FILE"
        source "$CONFIG_FILE"
    else
        log_warning "Configuration file not found: $CONFIG_FILE"
        log_info "Using default configuration"
    fi

    # Check dependencies
    if ! check_dependencies; then
        log_error "Dependency check failed"
        exit 1
    fi

    # Create backup directories
    log_info "Creating backup directories..."
    backup_subdir=$(create_backup_directories)
    log_success "Backup directory: $backup_subdir"

    # Perform backups
    local backup_status=0

    backup_database "$backup_subdir" || backup_status=1
    backup_files "$backup_subdir" || backup_status=1
    backup_blockchain "$backup_subdir" || backup_status=1
    backup_logs "$backup_subdir" || backup_status=1

    if [[ $backup_status -ne 0 ]]; then
        log_error "One or more backups failed"
        send_email_notification "failed" ""
        send_slack_notification "failed" ""
        exit 1
    fi

    # Compress backup
    backup_archive=$(compress_backup "$backup_subdir")

    # Encrypt backup
    final_backup=$(encrypt_backup "$backup_archive")

    # Upload to cloud storage
    upload_to_s3 "$final_backup"
    upload_to_azure "$final_backup"

    # Apply retention policy
    apply_retention_policy

    # Send notifications
    send_email_notification "success" "$final_backup"
    send_slack_notification "success" "$final_backup"

    echo ""
    echo "================================================================================"
    log_success "Backup completed successfully!"
    echo "================================================================================"
    log_info "Backup file: $final_backup"
    log_info "Size: $(du -h "$final_backup" 2>/dev/null | cut -f1 || echo 'N/A')"
    log_info "Log file: $LOG_FILE"
    echo "================================================================================"

    exit 0
}

# Run main function
main "$@"
