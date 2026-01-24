#!/bin/bash

# Script pour exécuter les tests backend avec pytest
# Usage: ./run_tests.sh [unit|integration|e2e|all|coverage]

set -e  # Exit on error

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Backend Tests - Pytest Runner${NC}"
echo -e "${GREEN}========================================${NC}\n"

# Activate virtual environment
if [ -d "venv" ]; then
    echo -e "${YELLOW}Activating virtual environment...${NC}"
    source venv/bin/activate
else
    echo -e "${RED}Error: Virtual environment not found${NC}"
    echo -e "${YELLOW}Please create it with: python -m venv venv${NC}"
    exit 1
fi

# Install test dependencies
echo -e "${YELLOW}Checking test dependencies...${NC}"
pip install -q pytest pytest-asyncio pytest-cov httpx

# Default to all tests
TEST_TYPE=${1:-all}

case $TEST_TYPE in
    unit)
        echo -e "${GREEN}Running UNIT tests...${NC}\n"
        pytest tests/unit -v -m unit
        ;;

    integration)
        echo -e "${GREEN}Running INTEGRATION tests...${NC}\n"
        pytest tests/integration -v -m integration
        ;;

    e2e)
        echo -e "${GREEN}Running E2E tests...${NC}\n"
        pytest tests/e2e -v -m e2e
        ;;

    blockchain)
        echo -e "${GREEN}Running BLOCKCHAIN tests...${NC}\n"
        pytest tests -v -m blockchain
        ;;

    websocket)
        echo -e "${GREEN}Running WEBSOCKET tests...${NC}\n"
        pytest tests -v -m websocket
        ;;

    ml)
        echo -e "${GREEN}Running ML tests...${NC}\n"
        pytest tests -v -m ml
        ;;

    coverage)
        echo -e "${GREEN}Running tests with COVERAGE report...${NC}\n"
        pytest tests -v --cov=app --cov-report=html --cov-report=term-missing
        echo -e "\n${GREEN}Coverage report generated in htmlcov/index.html${NC}"
        ;;

    all)
        echo -e "${GREEN}Running ALL tests...${NC}\n"
        pytest tests -v
        ;;

    *)
        echo -e "${RED}Error: Invalid test type${NC}"
        echo -e "${YELLOW}Usage: ./run_tests.sh [unit|integration|e2e|blockchain|websocket|ml|coverage|all]${NC}"
        exit 1
        ;;
esac

# Check exit code
if [ $? -eq 0 ]; then
    echo -e "\n${GREEN}========================================${NC}"
    echo -e "${GREEN}  ✅ All tests passed!${NC}"
    echo -e "${GREEN}========================================${NC}"
else
    echo -e "\n${RED}========================================${NC}"
    echo -e "${RED}  ❌ Some tests failed${NC}"
    echo -e "${RED}========================================${NC}"
    exit 1
fi
