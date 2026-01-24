#!/bin/bash
# ==============================================================================
# Stop Script for Système Gaveurs V3.0 (Linux/macOS)
# ==============================================================================
# Usage:
#   ./scripts/stop.sh [all|backend|frontend-euralis|frontend-gaveurs|frontend-sqal|simulator|db]
# ==============================================================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Project root directory
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# PID file directory
PID_DIR="$PROJECT_ROOT/.pids"

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Stop a process by PID file
stop_process() {
    local name="$1"
    local pid_file="$2"

    if [ ! -f "$pid_file" ]; then
        log_warning "$name is not running (no PID file)"
        return 0
    fi

    local pid=$(cat "$pid_file")

    if ! ps -p "$pid" > /dev/null 2>&1; then
        log_warning "$name is not running (stale PID file)"
        rm -f "$pid_file"
        return 0
    fi

    log_info "Stopping $name (PID: $pid)..."
    kill "$pid" 2>/dev/null || true

    # Wait for process to stop (max 10 seconds)
    for i in {1..10}; do
        if ! ps -p "$pid" > /dev/null 2>&1; then
            rm -f "$pid_file"
            log_success "$name stopped"
            return 0
        fi
        sleep 1
    done

    # Force kill if still running
    log_warning "$name did not stop gracefully, forcing..."
    kill -9 "$pid" 2>/dev/null || true
    rm -f "$pid_file"
    log_success "$name force stopped"
}

# Stop Database
stop_db() {
    log_info "Stopping TimescaleDB..."

    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed!"
        exit 1
    fi

    if docker ps --format '{{.Names}}' | grep -q "^gaveurs_timescaledb$"; then
        docker stop gaveurs_timescaledb
        log_success "TimescaleDB stopped"
    else
        log_warning "TimescaleDB is not running"
    fi
}

# Stop Backend
stop_backend() {
    stop_process "Backend" "$PID_DIR/backend.pid"
}

# Stop Frontend Euralis
stop_frontend_euralis() {
    stop_process "Frontend Euralis" "$PID_DIR/frontend-euralis.pid"
}

# Stop Frontend Gaveurs
stop_frontend_gaveurs() {
    stop_process "Frontend Gaveurs" "$PID_DIR/frontend-gaveurs.pid"
}

# Stop Frontend SQAL
stop_frontend_sqal() {
    stop_process "Frontend SQAL" "$PID_DIR/frontend-sqal.pid"
}

# Stop Simulator
stop_simulator() {
    stop_process "Simulator" "$PID_DIR/simulator.pid"
}

# Stop all components
stop_all() {
    log_info "Stopping all components..."
    echo ""

    stop_simulator
    echo ""

    stop_frontend_sqal
    echo ""

    stop_frontend_gaveurs
    echo ""

    stop_frontend_euralis
    echo ""

    stop_backend
    echo ""

    stop_db
    echo ""

    log_success "All components stopped successfully!"
}

# Main script logic
main() {
    local component="${1:-all}"

    log_info "==================================================================="
    log_info "Système Gaveurs V3.0 - Stop Script"
    log_info "==================================================================="
    echo ""

    case "$component" in
        all)
            stop_all
            ;;
        db|database)
            stop_db
            ;;
        backend)
            stop_backend
            ;;
        frontend-euralis)
            stop_frontend_euralis
            ;;
        frontend-gaveurs)
            stop_frontend_gaveurs
            ;;
        frontend-sqal)
            stop_frontend_sqal
            ;;
        simulator)
            stop_simulator
            ;;
        *)
            log_error "Unknown component: $component"
            echo ""
            echo "Usage: $0 [all|db|backend|frontend-euralis|frontend-gaveurs|frontend-sqal|simulator]"
            exit 1
            ;;
    esac

    echo ""
    log_info "Stop process completed at $(date)"
}

# Run main function
main "$@"
