#!/bin/bash
# ==============================================================================
# Test Runner Script for Système Gaveurs V3.0 (Linux/macOS)
# ==============================================================================
# Usage:
#   ./scripts/run_tests.sh [all|unit|integration|e2e|websocket|coverage]
# ==============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Project root directory
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Install test dependencies
install_deps() {
    log_info "Installing test dependencies..."

    cd "$PROJECT_ROOT"

    # Backend test dependencies
    if [ -d "backend/venv" ]; then
        source backend/venv/bin/activate
        pip install -r tests/requirements.txt
        deactivate
        log_success "Backend test dependencies installed"
    else
        log_error "Backend virtual environment not found. Run ./scripts/build.sh backend first"
        exit 1
    fi
}

# Run unit tests
run_unit_tests() {
    log_info "Running unit tests..."

    cd "$PROJECT_ROOT/backend-api"
    source venv/bin/activate

    pytest tests/unit/ -v --tb=short -m "unit"

    deactivate
}

# Run integration tests
run_integration_tests() {
    log_info "Running integration tests..."

    cd "$PROJECT_ROOT/backend-api"
    source venv/bin/activate

    pytest tests/integration/ -v --tb=short -m "integration"

    deactivate
}

# Run E2E tests
run_e2e_tests() {
    log_info "Running E2E tests..."

    # Check if backend is running
    if ! curl -s http://localhost:8000/health > /dev/null 2>&1; then
        log_error "Backend is not running. Start it with: ./scripts/start.sh backend"
        exit 1
    fi

    cd "$PROJECT_ROOT"

    pytest tests/e2e/test_complete_flow.py -v --tb=short -m "e2e"
}

# Run WebSocket tests
run_websocket_tests() {
    log_info "Running WebSocket tests..."

    # Check if backend is running
    if ! curl -s http://localhost:8000/health > /dev/null 2>&1; then
        log_error "Backend is not running. Start it with: ./scripts/start.sh backend"
        exit 1
    fi

    cd "$PROJECT_ROOT"

    pytest tests/websocket/test_websocket_flow.py -v --tb=short -m "websocket"
}

# Run all tests
run_all_tests() {
    log_info "Running all tests..."

    cd "$PROJECT_ROOT"

    # Run unit tests (don't need backend running)
    if [ -f "backend/tests/unit/test_*.py" ]; then
        run_unit_tests
        echo ""
    fi

    # Run integration tests
    if [ -f "backend/tests/integration/test_*.py" ]; then
        run_integration_tests
        echo ""
    fi

    # Run E2E tests (need backend running)
    run_e2e_tests
    echo ""

    # Run WebSocket tests
    run_websocket_tests
    echo ""
}

# Generate coverage report
generate_coverage() {
    log_info "Generating coverage report..."

    cd "$PROJECT_ROOT"

    pytest tests/ -v --cov=backend/app --cov-report=html --cov-report=term-missing

    log_success "Coverage report generated in htmlcov/index.html"

    # Open coverage report in browser (optional)
    if command -v xdg-open > /dev/null 2>&1; then
        xdg-open htmlcov/index.html
    elif command -v open > /dev/null 2>&1; then
        open htmlcov/index.html
    fi
}

# Main script logic
main() {
    local test_type="${1:-all}"

    echo -e "${CYAN}===================================================================${NC}"
    echo -e "${CYAN}Système Gaveurs V3.0 - Test Runner${NC}"
    echo -e "${CYAN}===================================================================${NC}"
    echo ""

    case "$test_type" in
        install|deps)
            install_deps
            ;;
        unit)
            run_unit_tests
            ;;
        integration)
            run_integration_tests
            ;;
        e2e)
            run_e2e_tests
            ;;
        websocket|ws)
            run_websocket_tests
            ;;
        all)
            run_all_tests
            ;;
        coverage|cov)
            generate_coverage
            ;;
        *)
            log_error "Unknown test type: $test_type"
            echo ""
            echo "Usage: $0 [all|unit|integration|e2e|websocket|coverage|install]"
            exit 1
            ;;
    esac

    echo ""
    log_success "Test execution completed!"
}

# Run main function
main "$@"
