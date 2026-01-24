#!/bin/bash
# ==============================================================================
# Start Script for Système Gaveurs V3.0 (Linux/macOS)
# ==============================================================================
# Usage:
#   ./scripts/start.sh [all|backend|frontend-euralis|frontend-gaveurs|frontend-sqal|simulator|db]
# ==============================================================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Project root directory
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# PID file directory
PID_DIR="$PROJECT_ROOT/.pids"
mkdir -p "$PID_DIR"

# Log directory
LOG_DIR="$PROJECT_ROOT/logs"
mkdir -p "$LOG_DIR"

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

# Check if a process is running
is_running() {
    local pid_file="$1"
    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file")
        if ps -p "$pid" > /dev/null 2>&1; then
            return 0
        else
            rm -f "$pid_file"
            return 1
        fi
    fi
    return 1
}

# Start Database (TimescaleDB)
start_db() {
    log_info "Starting TimescaleDB..."

    # Check if Docker is installed
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed!"
        exit 1
    fi

    # Check if container already exists
    if docker ps -a --format '{{.Names}}' | grep -q "^gaveurs_timescaledb$"; then
        if docker ps --format '{{.Names}}' | grep -q "^gaveurs_timescaledb$"; then
            log_warning "TimescaleDB is already running"
            return 0
        else
            log_info "Starting existing TimescaleDB container..."
            docker start gaveurs_timescaledb
        fi
    else
        log_info "Creating new TimescaleDB container..."
        docker run -d \
            --name gaveurs_timescaledb \
            -p 5432:5432 \
            -e POSTGRES_DB=gaveurs_db \
            -e POSTGRES_USER=gaveurs_admin \
            -e POSTGRES_PASSWORD=gaveurs_secure_2024 \
            -v gaveurs_timescaledb_data:/var/lib/postgresql/data \
            timescale/timescaledb:latest-pg15
    fi

    # Wait for database to be ready
    log_info "Waiting for database to be ready..."
    for i in {1..30}; do
        if docker exec gaveurs_timescaledb pg_isready -U gaveurs_admin > /dev/null 2>&1; then
            log_success "TimescaleDB is ready!"
            return 0
        fi
        sleep 1
    done

    log_error "TimescaleDB failed to start within 30 seconds"
    exit 1
}

# Start Backend
start_backend() {
    log_info "Starting Backend (FastAPI)..."

    if is_running "$PID_DIR/backend.pid"; then
        log_warning "Backend is already running (PID: $(cat $PID_DIR/backend.pid))"
        return 0
    fi

    cd "$PROJECT_ROOT/backend-api"

    # Activate virtual environment
    source venv/bin/activate

    # Start Uvicorn in background
    log_info "Starting Uvicorn on http://localhost:8000"
    nohup uvicorn app.main:app \
        --host 0.0.0.0 \
        --port 8000 \
        --reload \
        > "$LOG_DIR/backend.log" 2>&1 &

    local pid=$!
    echo $pid > "$PID_DIR/backend.pid"

    # Wait for backend to be ready
    log_info "Waiting for backend to be ready..."
    for i in {1..30}; do
        if curl -s http://localhost:8000/health > /dev/null 2>&1; then
            log_success "Backend is ready! (PID: $pid)"
            deactivate
            return 0
        fi
        sleep 1
    done

    log_error "Backend failed to start within 30 seconds"
    deactivate
    exit 1
}

# Start Frontend Euralis
start_frontend_euralis() {
    log_info "Starting Frontend Euralis (Next.js)..."

    if is_running "$PID_DIR/frontend-euralis.pid"; then
        log_warning "Frontend Euralis is already running (PID: $(cat $PID_DIR/frontend-euralis.pid))"
        return 0
    fi

    cd "$PROJECT_ROOT/frontend"

    # Start Next.js in development mode
    log_info "Starting Next.js on http://localhost:3000"
    nohup npm run dev -- -p 3000 > "$LOG_DIR/frontend-euralis.log" 2>&1 &

    local pid=$!
    echo $pid > "$PID_DIR/frontend-euralis.pid"

    log_success "Frontend Euralis started! (PID: $pid)"
}

# Start Frontend Gaveurs
start_frontend_gaveurs() {
    log_info "Starting Frontend Gaveurs (Next.js)..."

    if is_running "$PID_DIR/frontend-gaveurs.pid"; then
        log_warning "Frontend Gaveurs is already running (PID: $(cat $PID_DIR/frontend-gaveurs.pid))"
        return 0
    fi

    cd "$PROJECT_ROOT/gaveurs-frontend"

    # Start Next.js in development mode
    log_info "Starting Next.js on http://localhost:3001"
    nohup npm run dev -- -p 3001 > "$LOG_DIR/frontend-gaveurs.log" 2>&1 &

    local pid=$!
    echo $pid > "$PID_DIR/frontend-gaveurs.pid"

    log_success "Frontend Gaveurs started! (PID: $pid)"
}

# Start Frontend SQAL
start_frontend_sqal() {
    log_info "Starting Frontend SQAL (React + Vite)..."

    if is_running "$PID_DIR/frontend-sqal.pid"; then
        log_warning "Frontend SQAL is already running (PID: $(cat $PID_DIR/frontend-sqal.pid))"
        return 0
    fi

    cd "$PROJECT_ROOT/sqal"

    # Start Vite in development mode
    log_info "Starting Vite on http://localhost:5173"
    nohup npm run dev > "$LOG_DIR/frontend-sqal.log" 2>&1 &

    local pid=$!
    echo $pid > "$PID_DIR/frontend-sqal.pid"

    log_success "Frontend SQAL started! (PID: $pid)"
}

# Start Simulator
start_simulator() {
    log_info "Starting Simulator SQAL..."

    if is_running "$PID_DIR/simulator.pid"; then
        log_warning "Simulator is already running (PID: $(cat $PID_DIR/simulator.pid))"
        return 0
    fi

    cd "$PROJECT_ROOT/simulator-sqal"

    # Activate virtual environment
    source venv/bin/activate

    # Start simulator
    log_info "Starting simulator with WebSocket connection to ws://localhost:8000/ws/sensors/"
    nohup python main.py > "$LOG_DIR/simulator.log" 2>&1 &

    local pid=$!
    echo $pid > "$PID_DIR/simulator.pid"

    log_success "Simulator started! (PID: $pid)"
    deactivate
}

# Start all components
start_all() {
    log_info "Starting all components..."
    echo ""

    start_db
    echo ""

    # Wait a bit for DB to be fully ready
    sleep 2

    start_backend
    echo ""

    # Wait for backend to be fully ready
    sleep 3

    start_frontend_euralis
    echo ""

    start_frontend_gaveurs
    echo ""

    start_frontend_sqal
    echo ""

    start_simulator
    echo ""

    log_success "All components started successfully!"
    echo ""
    echo -e "${CYAN}========================================${NC}"
    echo -e "${CYAN}Services Status:${NC}"
    echo -e "${CYAN}========================================${NC}"
    echo -e "  ${GREEN}✓${NC} TimescaleDB:       http://localhost:5432"
    echo -e "  ${GREEN}✓${NC} Backend API:       http://localhost:8000"
    echo -e "  ${GREEN}✓${NC} API Docs:          http://localhost:8000/docs"
    echo -e "  ${GREEN}✓${NC} Frontend Euralis:  http://localhost:3000"
    echo -e "  ${GREEN}✓${NC} Frontend Gaveurs:  http://localhost:3001"
    echo -e "  ${GREEN}✓${NC} Frontend SQAL:     http://localhost:5173"
    echo -e "  ${GREEN}✓${NC} Simulator:         Running in background"
    echo -e "${CYAN}========================================${NC}"
    echo ""
    echo -e "${YELLOW}Logs are available in: $LOG_DIR${NC}"
    echo -e "${YELLOW}To stop all services: ./scripts/stop.sh all${NC}"
}

# Show status
show_status() {
    echo -e "${CYAN}========================================${NC}"
    echo -e "${CYAN}Services Status:${NC}"
    echo -e "${CYAN}========================================${NC}"

    # Check TimescaleDB
    if docker ps --format '{{.Names}}' | grep -q "^gaveurs_timescaledb$"; then
        echo -e "  ${GREEN}✓${NC} TimescaleDB:       Running"
    else
        echo -e "  ${RED}✗${NC} TimescaleDB:       Not running"
    fi

    # Check Backend
    if is_running "$PID_DIR/backend.pid"; then
        echo -e "  ${GREEN}✓${NC} Backend:           Running (PID: $(cat $PID_DIR/backend.pid))"
    else
        echo -e "  ${RED}✗${NC} Backend:           Not running"
    fi

    # Check Frontend Euralis
    if is_running "$PID_DIR/frontend-euralis.pid"; then
        echo -e "  ${GREEN}✓${NC} Frontend Euralis:  Running (PID: $(cat $PID_DIR/frontend-euralis.pid))"
    else
        echo -e "  ${RED}✗${NC} Frontend Euralis:  Not running"
    fi

    # Check Frontend Gaveurs
    if is_running "$PID_DIR/frontend-gaveurs.pid"; then
        echo -e "  ${GREEN}✓${NC} Frontend Gaveurs:  Running (PID: $(cat $PID_DIR/frontend-gaveurs.pid))"
    else
        echo -e "  ${RED}✗${NC} Frontend Gaveurs:  Not running"
    fi

    # Check Frontend SQAL
    if is_running "$PID_DIR/frontend-sqal.pid"; then
        echo -e "  ${GREEN}✓${NC} Frontend SQAL:     Running (PID: $(cat $PID_DIR/frontend-sqal.pid))"
    else
        echo -e "  ${RED}✗${NC} Frontend SQAL:     Not running"
    fi

    # Check Simulator
    if is_running "$PID_DIR/simulator.pid"; then
        echo -e "  ${GREEN}✓${NC} Simulator:         Running (PID: $(cat $PID_DIR/simulator.pid))"
    else
        echo -e "  ${RED}✗${NC} Simulator:         Not running"
    fi

    echo -e "${CYAN}========================================${NC}"
}

# Main script logic
main() {
    local component="${1:-all}"

    log_info "==================================================================="
    log_info "Système Gaveurs V3.0 - Start Script"
    log_info "==================================================================="
    echo ""

    case "$component" in
        all)
            start_all
            ;;
        db|database)
            start_db
            ;;
        backend)
            start_backend
            ;;
        frontend-euralis)
            start_frontend_euralis
            ;;
        frontend-gaveurs)
            start_frontend_gaveurs
            ;;
        frontend-sqal)
            start_frontend_sqal
            ;;
        simulator)
            start_simulator
            ;;
        status)
            show_status
            ;;
        *)
            log_error "Unknown component: $component"
            echo ""
            echo "Usage: $0 [all|db|backend|frontend-euralis|frontend-gaveurs|frontend-sqal|simulator|status]"
            exit 1
            ;;
    esac

    echo ""
    log_info "Start process completed at $(date)"
}

# Run main function
main "$@"
