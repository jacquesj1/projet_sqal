#!/bin/bash
# ==============================================================================
# Euralis Gaveurs System - Comprehensive Restore Script
# ==============================================================================
# Purpose: Restore TimescaleDB database, files, and blockchain data from backup
# Usage: ./scripts/restore.sh [--list] [--backup FILE] [--dry-run] [--verify]
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
readonly LOG_FILE="${PROJECT_ROOT}/logs/restore_${TIMESTAMP}.log"

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

# Restore options
ENCRYPTION_PASSWORD="${ENCRYPTION_PASSWORD:-}"

# Flags
DRY_RUN=false
VERIFY_ONLY=false
LIST_BACKUPS=false
BACKUP_FILE=""
RESTORE_DATABASE=true
RESTORE_FILES=true
RESTORE_BLOCKCHAIN=true
RESTORE_LOGS=false

# ==============================================================================
# LOGGING FUNCTIONS
# ==============================================================================
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

    check_command psql || missing_deps+=("postgresql-client")
    check_command tar || missing_deps+=("tar")
    check_command gunzip || missing_deps+=("gzip")

    if [[ ${#missing_deps[@]} -gt 0 ]]; then
        log_error "Missing dependencies: ${missing_deps[*]}"
        log_info "Install with: sudo apt-get install ${missing_deps[*]}"
        return 1
    fi

    log_success "All dependencies satisfied"
    return 0
}

confirm_action() {
    local message=$1

    if [[ "$DRY_RUN" == "true" ]]; then
        return 0
    fi

    echo -e "${YELLOW}WARNING:${NC} $message"
    read -p "Are you sure you want to continue? [y/N] " -n 1 -r
    echo

    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_warning "Operation cancelled by user"
        return 1
    fi

    return 0
}

# ==============================================================================
# BACKUP LISTING & SELECTION
# ==============================================================================
list_available_backups() {
    log_info "Available backups in $BACKUP_DIR:"
    echo ""
    echo "================================================================================

"

    if [[ ! -d "$BACKUP_DIR" ]]; then
        log_warning "Backup directory not found: $BACKUP_DIR"
        return 1
    fi

    local backups=($(find "$BACKUP_DIR" -name "gaveurs_backup_*.tar.gz*" -o -name "gaveurs_backup_*.7z*" | sort -r))

    if [[ ${#backups[@]} -eq 0 ]]; then
        log_warning "No backups found in $BACKUP_DIR"
        return 1
    fi

    local idx=1
    for backup in "${backups[@]}"; do
        local size=$(du -h "$backup" | cut -f1)
        local date=$(stat -c %y "$backup" | cut -d' ' -f1)
        local time=$(stat -c %y "$backup" | cut -d' ' -f2 | cut -d'.' -f1)

        printf "%3d. %-60s %10s  %s %s\n" "$idx" "$(basename "$backup")" "$size" "$date" "$time"
        ((idx++))
    done

    echo ""
    echo "================================================================================"
    return 0
}

select_backup_file() {
    if [[ -n "$BACKUP_FILE" ]]; then
        if [[ ! -f "$BACKUP_FILE" ]]; then
            log_error "Backup file not found: $BACKUP_FILE"
            return 1
        fi
        return 0
    fi

    list_available_backups

    echo ""
    read -p "Select backup number (or 'q' to quit): " selection

    if [[ "$selection" == "q" ]]; then
        log_info "Operation cancelled"
        return 1
    fi

    local backups=($(find "$BACKUP_DIR" -name "gaveurs_backup_*.tar.gz*" -o -name "gaveurs_backup_*.7z*" | sort -r))
    local idx=$((selection - 1))

    if [[ $idx -lt 0 || $idx -ge ${#backups[@]} ]]; then
        log_error "Invalid selection"
        return 1
    fi

    BACKUP_FILE="${backups[$idx]}"
    log_info "Selected backup: $(basename "$BACKUP_FILE")"
    return 0
}

# ==============================================================================
# EXTRACTION FUNCTIONS
# ==============================================================================
decrypt_backup() {
    local backup_file=$1
    local output_file="${backup_file%.gpg}"

    if [[ ! "$backup_file" =~ \.gpg$ ]]; then
        echo "$backup_file"
        return 0
    fi

    log_info "Decrypting backup..."

    if [[ -z "$ENCRYPTION_PASSWORD" ]]; then
        log_error "Encrypted backup requires ENCRYPTION_PASSWORD"
        read -sp "Enter decryption password: " ENCRYPTION_PASSWORD
        echo
    fi

    if [[ "$DRY_RUN" == "true" ]]; then
        log_warning "DRY RUN: Would decrypt $backup_file"
        echo "$output_file"
        return 0
    fi

    echo "$ENCRYPTION_PASSWORD" | gpg \
        --batch \
        --yes \
        --passphrase-fd 0 \
        --decrypt \
        --output "$output_file" \
        "$backup_file" 2>&1 | tee -a "$LOG_FILE"

    if [[ $? -eq 0 ]]; then
        log_success "Decryption completed: $output_file"
        echo "$output_file"
        return 0
    else
        log_error "Decryption failed"
        return 1
    fi
}

extract_backup() {
    local backup_file=$1
    local extract_dir="${BACKUP_DIR}/restore_${TIMESTAMP}"

    log_info "Extracting backup archive..."

    mkdir -p "$extract_dir"

    if [[ "$DRY_RUN" == "true" ]]; then
        log_warning "DRY RUN: Would extract $backup_file to $extract_dir"
        echo "$extract_dir"
        return 0
    fi

    if [[ "$backup_file" =~ \.tar\.gz$ ]]; then
        tar -xzf "$backup_file" -C "$extract_dir" 2>&1 | tee -a "$LOG_FILE"
    elif [[ "$backup_file" =~ \.7z$ ]]; then
        7z x "$backup_file" -o"$extract_dir" 2>&1 | tee -a "$LOG_FILE"
    else
        log_error "Unsupported backup format: $backup_file"
        return 1
    fi

    if [[ $? -eq 0 ]]; then
        log_success "Extraction completed: $extract_dir"
        echo "$extract_dir"
        return 0
    else
        log_error "Extraction failed"
        return 1
    fi
}

# ==============================================================================
# RESTORE FUNCTIONS
# ==============================================================================
restore_database() {
    local extract_dir=$1
    local db_backup_file=$(find "$extract_dir" -name "gaveurs_db_*.sql" | head -n1)

    if [[ ! -f "$db_backup_file" ]]; then
        log_error "Database backup file not found in $extract_dir"
        return 1
    fi

    log_info "Restoring database from $db_backup_file..."

    if ! confirm_action "This will DROP and recreate the database '$DB_NAME'. All existing data will be lost!"; then
        return 1
    fi

    if [[ "$DRY_RUN" == "true" ]]; then
        log_warning "DRY RUN: Would restore database from $db_backup_file"
        return 0
    fi

    # Drop existing connections
    log_info "Terminating existing database connections..."
    PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c \
        "SELECT pg_terminate_backend(pg_stat_activity.pid) FROM pg_stat_activity WHERE pg_stat_activity.datname = '$DB_NAME' AND pid <> pg_backend_pid();" \
        2>&1 | tee -a "$LOG_FILE"

    # Restore database
    log_info "Restoring database..."
    PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres \
        -f "$db_backup_file" 2>&1 | tee -a "$LOG_FILE"

    if [[ $? -eq 0 ]]; then
        log_success "Database restore completed"

        # Verify TimescaleDB extension
        log_info "Verifying TimescaleDB extension..."
        PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
            -c "SELECT * FROM timescaledb_information.hypertables;" 2>&1 | tee -a "$LOG_FILE"

        return 0
    else
        log_error "Database restore failed"
        return 1
    fi
}

restore_files_data() {
    local extract_dir=$1
    local files_backup=$(find "$extract_dir" -name "uploaded_files_*.tar.gz" | head -n1)

    if [[ ! -f "$files_backup" ]]; then
        log_warning "Files backup not found, skipping"
        return 0
    fi

    log_info "Restoring files from $files_backup..."

    if ! confirm_action "This will overwrite existing uploaded files!"; then
        return 1
    fi

    if [[ "$DRY_RUN" == "true" ]]; then
        log_warning "DRY RUN: Would restore files from $files_backup"
        return 0
    fi

    tar -xzf "$files_backup" -C "/" 2>&1 | tee -a "$LOG_FILE"

    if [[ $? -eq 0 ]]; then
        log_success "Files restore completed"
        return 0
    else
        log_error "Files restore failed"
        return 1
    fi
}

restore_blockchain_data() {
    local extract_dir=$1
    local blockchain_backup=$(find "$extract_dir" -name "blockchain_*.sql" | head -n1)

    if [[ ! -f "$blockchain_backup" ]]; then
        log_warning "Blockchain backup not found, skipping"
        return 0
    fi

    log_info "Restoring blockchain data from $blockchain_backup..."

    if [[ "$DRY_RUN" == "true" ]]; then
        log_warning "DRY RUN: Would restore blockchain from $blockchain_backup"
        return 0
    fi

    PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
        -f "$blockchain_backup" 2>&1 | tee -a "$LOG_FILE"

    if [[ $? -eq 0 ]]; then
        log_success "Blockchain restore completed"
        return 0
    else
        log_error "Blockchain restore failed"
        return 1
    fi
}

restore_logs_data() {
    local extract_dir=$1
    local logs_backup=$(find "$extract_dir" -name "logs_*.tar.gz" | head -n1)

    if [[ ! -f "$logs_backup" ]]; then
        log_warning "Logs backup not found, skipping"
        return 0
    fi

    log_info "Restoring logs from $logs_backup..."

    if [[ "$DRY_RUN" == "true" ]]; then
        log_warning "DRY RUN: Would restore logs from $logs_backup"
        return 0
    fi

    tar -xzf "$logs_backup" -C "$PROJECT_ROOT" 2>&1 | tee -a "$LOG_FILE"

    if [[ $? -eq 0 ]]; then
        log_success "Logs restore completed"
        return 0
    else
        log_warning "Logs restore failed (non-critical)"
        return 0
    fi
}

# ==============================================================================
# VERIFICATION FUNCTIONS
# ==============================================================================
verify_restore() {
    log_info "Verifying restored database..."

    local checks_passed=0
    local checks_failed=0

    # Check database connection
    if PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1" &> /dev/null; then
        log_success "Database connection: OK"
        ((checks_passed++))
    else
        log_error "Database connection: FAILED"
        ((checks_failed++))
    fi

    # Check TimescaleDB extension
    local timescale_check=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM pg_extension WHERE extname='timescaledb';" 2>/dev/null | xargs)
    if [[ "$timescale_check" == "1" ]]; then
        log_success "TimescaleDB extension: OK"
        ((checks_passed++))
    else
        log_error "TimescaleDB extension: NOT INSTALLED"
        ((checks_failed++))
    fi

    # Check hypertables
    local hypertables_count=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM timescaledb_information.hypertables;" 2>/dev/null | xargs)
    if [[ "$hypertables_count" -gt 0 ]]; then
        log_success "Hypertables: $hypertables_count found"
        ((checks_passed++))
    else
        log_warning "Hypertables: None found"
    fi

    # Check key tables
    local tables=("gaveurs" "canards" "gavage_data" "sites_euralis" "lots_gavage")
    for table in "${tables[@]}"; do
        local count=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM $table;" 2>/dev/null | xargs)
        if [[ $? -eq 0 ]]; then
            log_success "Table $table: $count rows"
            ((checks_passed++))
        else
            log_error "Table $table: MISSING or ERROR"
            ((checks_failed++))
        fi
    done

    echo ""
    echo "================================================================================"
    log_info "Verification Summary: $checks_passed passed, $checks_failed failed"
    echo "================================================================================"

    return $checks_failed
}

# ==============================================================================
# ARGUMENT PARSING
# ==============================================================================
parse_arguments() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --list)
                LIST_BACKUPS=true
                shift
                ;;
            --backup)
                BACKUP_FILE="$2"
                shift 2
                ;;
            --dry-run)
                DRY_RUN=true
                shift
                ;;
            --verify)
                VERIFY_ONLY=true
                shift
                ;;
            --database-only)
                RESTORE_FILES=false
                RESTORE_BLOCKCHAIN=false
                RESTORE_LOGS=false
                shift
                ;;
            --help)
                cat <<EOF
Euralis Gaveurs Restore Script

Usage: $0 [OPTIONS]

Options:
    --list              List available backups
    --backup FILE       Restore from specific backup file
    --dry-run           Simulate restore without making changes
    --verify            Verify restore without restoring
    --database-only     Restore only database (skip files/blockchain)
    --help              Show this help message

Examples:
    $0 --list                           # List available backups
    $0                                  # Interactive restore
    $0 --backup backups/gaveurs_backup_20240101.tar.gz
    $0 --dry-run                        # Test restore
    $0 --verify                         # Verify current database
    $0 --database-only                  # Restore database only

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

# ==============================================================================
# MAIN EXECUTION
# ==============================================================================
main() {
    echo "================================================================================"
    echo "  Euralis Gaveurs System - Restore Script"
    echo "================================================================================"
    echo "  Timestamp: $TIMESTAMP"
    echo "  Log file: $LOG_FILE"
    echo "================================================================================"
    echo ""

    # Parse command line arguments
    parse_arguments "$@"

    # Create logs directory
    mkdir -p "${PROJECT_ROOT}/logs"

    # Load configuration file if exists
    if [[ -f "$CONFIG_FILE" ]]; then
        log_info "Loading configuration from $CONFIG_FILE"
        source "$CONFIG_FILE"
    fi

    # Handle --list option
    if [[ "$LIST_BACKUPS" == "true" ]]; then
        list_available_backups
        exit 0
    fi

    # Handle --verify option
    if [[ "$VERIFY_ONLY" == "true" ]]; then
        verify_restore
        exit $?
    fi

    # Check dependencies
    if ! check_dependencies; then
        log_error "Dependency check failed"
        exit 1
    fi

    # Select backup file
    if ! select_backup_file; then
        log_error "No backup file selected"
        exit 1
    fi

    # Decrypt if needed
    decrypted_file=$(decrypt_backup "$BACKUP_FILE")
    if [[ $? -ne 0 ]]; then
        log_error "Decryption failed"
        exit 1
    fi

    # Extract backup
    extract_dir=$(extract_backup "$decrypted_file")
    if [[ $? -ne 0 ]]; then
        log_error "Extraction failed"
        exit 1
    fi

    # Perform restore
    local restore_status=0

    if [[ "$RESTORE_DATABASE" == "true" ]]; then
        restore_database "$extract_dir" || restore_status=1
    fi

    if [[ "$RESTORE_FILES" == "true" ]]; then
        restore_files_data "$extract_dir" || restore_status=1
    fi

    if [[ "$RESTORE_BLOCKCHAIN" == "true" ]]; then
        restore_blockchain_data "$extract_dir" || restore_status=1
    fi

    if [[ "$RESTORE_LOGS" == "true" ]]; then
        restore_logs_data "$extract_dir" || restore_status=1
    fi

    # Verify restore
    verify_restore

    # Cleanup
    if [[ "$DRY_RUN" != "true" ]]; then
        log_info "Cleaning up temporary files..."
        rm -rf "$extract_dir"
        if [[ "$decrypted_file" != "$BACKUP_FILE" ]]; then
            rm -f "$decrypted_file"
        fi
    fi

    echo ""
    echo "================================================================================"
    if [[ $restore_status -eq 0 ]]; then
        log_success "Restore completed successfully!"
    else
        log_error "Restore completed with errors!"
    fi
    echo "================================================================================"
    log_info "Log file: $LOG_FILE"
    echo "================================================================================"

    exit $restore_status
}

# Run main function
main "$@"
