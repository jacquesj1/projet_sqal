#!/bin/bash

# SQAL FastAPI Stack Test Script
# Tests end-to-end integration: Simulator → Backend → Database → Frontend

set -e

echo "=========================================="
echo "SQAL FastAPI Stack Integration Test"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test results
TESTS_PASSED=0
TESTS_FAILED=0

test_result() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✓ PASS${NC}: $2"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${RED}✗ FAIL${NC}: $2"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
}

echo "1. Checking prerequisites..."
if command -v docker &> /dev/null && command -v docker-compose &> /dev/null; then
    test_result 0 "Docker and Docker Compose installed"
else
    test_result 1 "Docker or Docker Compose not found"
    exit 1
fi

echo ""
echo "2. Validating docker-compose.fastapi.yml..."
if docker-compose -f docker-compose.fastapi.yml config > /dev/null 2>&1; then
    test_result 0 "docker-compose.fastapi.yml is valid"
else
    test_result 1 "docker-compose.fastapi.yml has errors"
    exit 1
fi

echo ""
echo "3. Checking required files..."

files=(
    "docker-compose.fastapi.yml"
    "backend_new/Dockerfile"
    "backend_new/requirements.txt"
    "backend_new/app/main.py"
    "simulator/Dockerfile"
    "simulator/data_generator.py"
    "simulator/config_foiegras.yaml"
    "simulator/i2c_sensors_simulator.py"
    "simulator/vl53l8ch_raw_simulator.py"
    "simulator/as7341_raw_simulator.py"
    "simulator/vl53l8ch_data_analyzer.py"
    "simulator/as7341_data_analyzer.py"
)

for file in "${files[@]}"; do
    if [ -f "$file" ]; then
        test_result 0 "File exists: $file"
    else
        test_result 1 "File missing: $file"
    fi
done

echo ""
echo "4. Building Docker images..."
echo -e "${YELLOW}This may take a few minutes...${NC}"
if docker-compose -f docker-compose.fastapi.yml build > /tmp/docker_build.log 2>&1; then
    test_result 0 "Docker images built successfully"
else
    test_result 1 "Docker build failed (see /tmp/docker_build.log)"
    tail -20 /tmp/docker_build.log
    exit 1
fi

echo ""
echo "5. Starting services..."
echo -e "${YELLOW}Starting TimescaleDB, Backend, Simulator, Frontend...${NC}"

# Stop any existing containers
docker-compose -f docker-compose.fastapi.yml down -v > /dev/null 2>&1 || true

# Start services
docker-compose -f docker-compose.fastapi.yml up -d

# Wait for services to be healthy
echo "Waiting for services to be ready..."
sleep 10

echo ""
echo "6. Checking service health..."

# Check TimescaleDB
if docker-compose -f docker-compose.fastapi.yml ps timescaledb | grep -q "Up"; then
    test_result 0 "TimescaleDB is running"

    # Check database health
    if docker-compose -f docker-compose.fastapi.yml exec -T timescaledb pg_isready -U sqal_user > /dev/null 2>&1; then
        test_result 0 "TimescaleDB is healthy"
    else
        test_result 1 "TimescaleDB not responding"
    fi
else
    test_result 1 "TimescaleDB is not running"
fi

# Check Backend
if docker-compose -f docker-compose.fastapi.yml ps backend | grep -q "Up"; then
    test_result 0 "Backend is running"

    # Wait for backend to be fully ready
    echo "Waiting for backend to initialize..."
    sleep 5

    # Try to reach backend API
    if curl -s http://localhost:8000/health > /dev/null 2>&1; then
        test_result 0 "Backend API is responding"

        # Check API response
        HEALTH=$(curl -s http://localhost:8000/health)
        if echo "$HEALTH" | grep -q "healthy"; then
            test_result 0 "Backend health check passed"
        else
            test_result 1 "Backend health check failed"
            echo "Health response: $HEALTH"
        fi
    else
        test_result 1 "Backend API not responding on port 8000"
        echo "Backend logs:"
        docker-compose -f docker-compose.fastapi.yml logs --tail=20 backend
    fi
else
    test_result 1 "Backend is not running"
fi

# Check Simulator
if docker-compose -f docker-compose.fastapi.yml ps simulator | grep -q "Up"; then
    test_result 0 "Simulator is running"

    # Check simulator logs for successful connection
    sleep 5
    if docker-compose -f docker-compose.fastapi.yml logs simulator | grep -q "Connecté au backend"; then
        test_result 0 "Simulator connected to backend"
    else
        echo -e "${YELLOW}⚠ Warning${NC}: Simulator may not be connected yet"
        echo "Simulator logs:"
        docker-compose -f docker-compose.fastapi.yml logs --tail=10 simulator
    fi

    # Check for sample generation
    sleep 5
    if docker-compose -f docker-compose.fastapi.yml logs simulator | grep -q "Échantillon"; then
        test_result 0 "Simulator is generating samples"
    else
        echo -e "${YELLOW}⚠ Warning${NC}: No samples sent yet (may need more time)"
    fi
else
    test_result 1 "Simulator is not running"
fi

echo ""
echo "7. Testing data flow..."

# Wait for samples to be generated and stored
echo "Waiting 15 seconds for data generation..."
sleep 15

# Check if data is in database
DB_CHECK=$(docker-compose -f docker-compose.fastapi.yml exec -T timescaledb psql -U sqal_user -d sqal_db -t -c "SELECT COUNT(*) FROM sensor_samples;" 2>/dev/null || echo "0")
DB_COUNT=$(echo $DB_CHECK | tr -d ' ')

if [ "$DB_COUNT" -gt 0 ]; then
    test_result 0 "Data is being stored in database ($DB_COUNT samples)"

    # Show sample data
    echo -e "${BLUE}Sample data in database:${NC}"
    docker-compose -f docker-compose.fastapi.yml exec -T timescaledb psql -U sqal_user -d sqal_db -c "SELECT device_id, sample_id, fusion_final_grade, fusion_final_score, timestamp FROM sensor_samples ORDER BY timestamp DESC LIMIT 3;"
else
    test_result 1 "No data in database yet"
    echo "Backend logs:"
    docker-compose -f docker-compose.fastapi.yml logs --tail=30 backend
fi

echo ""
echo "8. Testing API endpoints..."

ENDPOINTS=(
    "/api/dashboard/metrics/"
    "/api/analysis/history/"
    "/api/sensors/fusion/"
    "/api/ai/models/"
)

for endpoint in "${ENDPOINTS[@]}"; do
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:8000$endpoint")
    if [ "$HTTP_CODE" = "200" ]; then
        test_result 0 "Endpoint accessible: $endpoint"
    else
        test_result 1 "Endpoint failed ($HTTP_CODE): $endpoint"
    fi
done

echo ""
echo "9. Testing WebSocket connection..."

# Test WebSocket endpoint exists
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/ws/realtime/ 2>/dev/null || echo "000")
if [ "$HTTP_CODE" = "426" ] || [ "$HTTP_CODE" = "400" ]; then
    test_result 0 "WebSocket endpoint exists (426/400 = Upgrade Required)"
else
    echo -e "${YELLOW}⚠ Warning${NC}: WebSocket endpoint returned: $HTTP_CODE"
fi

echo ""
echo "10. Checking logs for errors..."

BACKEND_ERRORS=$(docker-compose -f docker-compose.fastapi.yml logs backend 2>&1 | grep -i "ERROR" | grep -v "ERROR_MESSAGES" | wc -l)
SIMULATOR_ERRORS=$(docker-compose -f docker-compose.fastapi.yml logs simulator 2>&1 | grep -i "ERROR" | wc -l)

if [ "$BACKEND_ERRORS" -eq 0 ]; then
    test_result 0 "No errors in backend logs"
else
    echo -e "${YELLOW}⚠ Warning${NC}: $BACKEND_ERRORS error(s) in backend logs"
    echo "Recent errors:"
    docker-compose -f docker-compose.fastapi.yml logs backend | grep -i "ERROR" | tail -5
fi

if [ "$SIMULATOR_ERRORS" -eq 0 ]; then
    test_result 0 "No errors in simulator logs"
else
    echo -e "${YELLOW}⚠ Warning${NC}: $SIMULATOR_ERRORS error(s) in simulator logs"
fi

echo ""
echo "=========================================="
echo "Test Summary"
echo "=========================================="
echo -e "Tests Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Tests Failed: ${RED}$TESTS_FAILED${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All tests passed!${NC}"
    echo ""
    echo "Services are running:"
    echo "  - Backend:   http://localhost:8000"
    echo "  - API Docs:  http://localhost:8000/docs"
    echo "  - Frontend:  http://localhost:5173"
    echo "  - Database:  localhost:5432"
    echo ""
    echo "View logs: docker-compose -f docker-compose.fastapi.yml logs -f"
    echo "Stop:      docker-compose -f docker-compose.fastapi.yml down"
    exit 0
else
    echo -e "${RED}✗ Some tests failed${NC}"
    echo ""
    echo "Debug commands:"
    echo "  docker-compose -f docker-compose.fastapi.yml logs backend"
    echo "  docker-compose -f docker-compose.fastapi.yml logs simulator"
    echo "  docker-compose -f docker-compose.fastapi.yml logs timescaledb"
    echo "  docker-compose -f docker-compose.fastapi.yml ps"
    echo ""
    echo "To stop: docker-compose -f docker-compose.fastapi.yml down -v"
    exit 1
fi
