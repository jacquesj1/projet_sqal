#!/bin/bash
# ==============================================================================
# Build Script for Système Gaveurs V3.0 (Linux/macOS)
# ==============================================================================
# Usage:
#   ./scripts/build.sh [all|backend|frontend-euralis|frontend-gaveurs|frontend-sqal|simulator]
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

# Build Backend
build_backend() {
    log_info "Building Backend (FastAPI)..."

    cd "$PROJECT_ROOT/backend-api"

    # Check if virtual environment exists
    if [ ! -d "venv" ]; then
        log_warning "Virtual environment not found. Creating..."
        python3 -m venv venv
    fi

    # Activate virtual environment
    source venv/bin/activate

    # Upgrade pip
    log_info "Upgrading pip..."
    pip install --upgrade pip

    # Install dependencies
    log_info "Installing Python dependencies..."
    if [ -f "requirements.txt" ]; then
        pip install -r requirements.txt
    else
        log_error "requirements.txt not found!"
        exit 1
    fi

    # Run type checking (optional)
    if command -v mypy &> /dev/null; then
        log_info "Running type checks..."
        mypy app/ --ignore-missing-imports || log_warning "Type checking found issues"
    fi

    # Compile Python files
    log_info "Compiling Python files..."
    python -m compileall app/ -q

    deactivate

    log_success "Backend build completed!"
}

# Build Frontend Euralis
build_frontend_euralis() {
    log_info "Building Frontend Euralis (Next.js)..."

    cd "$PROJECT_ROOT/frontend"

    # Install dependencies
    if [ ! -d "node_modules" ]; then
        log_info "Installing npm dependencies..."
        npm install
    else
        log_info "Updating npm dependencies..."
        npm install
    fi

    # Build Next.js application
    log_info "Building Next.js application..."
    npm run build

    log_success "Frontend Euralis build completed!"
}

# Build Frontend Gaveurs
build_frontend_gaveurs() {
    log_info "Building Frontend Gaveurs (Next.js)..."

    cd "$PROJECT_ROOT/gaveurs-frontend"

    # Install dependencies
    if [ ! -d "node_modules" ]; then
        log_info "Installing npm dependencies..."
        npm install
    else
        log_info "Updating npm dependencies..."
        npm install
    fi

    # Build Next.js application
    log_info "Building Next.js application..."
    npm run build

    log_success "Frontend Gaveurs build completed!"
}

# Build Frontend SQAL
build_frontend_sqal() {
    log_info "Building Frontend SQAL (React + Vite)..."

    cd "$PROJECT_ROOT/sqal"

    # Install dependencies
    if [ ! -d "node_modules" ]; then
        log_info "Installing npm dependencies..."
        npm install
    else
        log_info "Updating npm dependencies..."
        npm install
    fi

    # Build Vite application
    log_info "Building Vite application..."
    npm run build

    log_success "Frontend SQAL build completed!"
}

# Build Simulator
build_simulator() {
    log_info "Building Simulator SQAL..."

    cd "$PROJECT_ROOT/simulator-sqal"

    # Check if virtual environment exists
    if [ ! -d "venv" ]; then
        log_warning "Virtual environment not found. Creating..."
        python3 -m venv venv
    fi

    # Activate virtual environment
    source venv/bin/activate

    # Upgrade pip
    log_info "Upgrading pip..."
    pip install --upgrade pip

    # Install dependencies
    log_info "Installing Python dependencies..."
    if [ -f "requirements.txt" ]; then
        pip install -r requirements.txt
    else
        log_warning "requirements.txt not found for simulator"
    fi

    # Compile Python files
    log_info "Compiling Python files..."
    python -m compileall . -q

    deactivate

    log_success "Simulator build completed!"
}

# Build all components
build_all() {
    log_info "Building all components..."
    echo ""

    build_backend
    echo ""

    build_frontend_euralis
    echo ""

    build_frontend_gaveurs
    echo ""

    build_frontend_sqal
    echo ""

    build_simulator
    echo ""

    log_success "All components built successfully!"
}

# Main script logic
main() {
    local component="${1:-all}"

    log_info "==================================================================="
    log_info "Système Gaveurs V3.0 - Build Script"
    log_info "==================================================================="
    echo ""

    case "$component" in
        all)
            build_all
            ;;
        backend)
            build_backend
            ;;
        frontend-euralis)
            build_frontend_euralis
            ;;
        frontend-gaveurs)
            build_frontend_gaveurs
            ;;
        frontend-sqal)
            build_frontend_sqal
            ;;
        simulator)
            build_simulator
            ;;
        *)
            log_error "Unknown component: $component"
            echo ""
            echo "Usage: $0 [all|backend|frontend-euralis|frontend-gaveurs|frontend-sqal|simulator]"
            exit 1
            ;;
    esac

    echo ""
    log_info "Build process completed at $(date)"
}

# Run main function
main "$@"
