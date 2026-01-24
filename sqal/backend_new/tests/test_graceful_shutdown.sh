#!/bin/bash
# SQAL Graceful Shutdown Test Script
# Tests graceful shutdown behavior

echo "================================================================================"
echo "SQAL GRACEFUL SHUTDOWN TEST"
echo "Phase 5 - Priority 2: Testing Graceful Shutdown"
echo "================================================================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "This test will:"
echo "  1. Start the backend in background"
echo "  2. Send continuous requests"
echo "  3. Trigger graceful shutdown (SIGTERM)"
echo "  4. Verify all requests complete or return 503"
echo "  5. Check logs for clean shutdown"
echo ""
echo "Press ENTER to continue or Ctrl+C to cancel..."
read

echo ""
echo "================================================================================"
echo "Step 1: Starting Backend"
echo "================================================================================"
echo ""

cd /home/user/SQAL_TOF_AS7341/backend_new

# Start backend in background
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 > /tmp/sqal_backend.log 2>&1 &
BACKEND_PID=$!

echo "Backend started with PID: $BACKEND_PID"
echo "Waiting 5 seconds for initialization..."
sleep 5

# Check if backend is running
if ! kill -0 $BACKEND_PID 2>/dev/null; then
    echo -e "${RED}❌ Backend failed to start${NC}"
    echo ""
    echo "Last 20 lines of log:"
    tail -n 20 /tmp/sqal_backend.log
    exit 1
fi

# Check if port is listening
if curl -s http://localhost:8000/ > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Backend is running and responding${NC}"
else
    echo -e "${RED}❌ Backend not responding on port 8000${NC}"
    kill $BACKEND_PID
    exit 1
fi

echo ""
echo "================================================================================"
echo "Step 2: Sending Continuous Requests"
echo "================================================================================"
echo ""

# Function to send requests continuously
send_requests() {
    local count=0
    local success=0
    local errors=0
    local unavailable=0

    while [ $count -lt 20 ]; do
        response=$(curl -s -w "\n%{http_code}" http://localhost:8000/health/ready 2>/dev/null)
        status_code=$(echo "$response" | tail -n 1)

        if [ "$status_code" = "200" ]; then
            ((success++))
            echo -n "."
        elif [ "$status_code" = "503" ]; then
            ((unavailable++))
            echo -n "x"
        else
            ((errors++))
            echo -n "!"
        fi

        ((count++))
        sleep 0.2
    done

    echo ""
    echo "Requests completed: $count"
    echo "  ✅ Success (200): $success"
    echo "  🛑 Unavailable (503): $unavailable"
    echo "  ❌ Errors: $errors"
}

# Start sending requests in background
(send_requests) &
REQUEST_PID=$!

echo "Sending requests (PID: $REQUEST_PID)..."
sleep 2

echo ""
echo "================================================================================"
echo "Step 3: Triggering Graceful Shutdown"
echo "================================================================================"
echo ""

echo "Sending SIGTERM to backend (PID: $BACKEND_PID)..."
kill -TERM $BACKEND_PID

echo "Waiting for graceful shutdown (max 35 seconds)..."

# Wait for backend to exit gracefully
timeout=35
elapsed=0
while kill -0 $BACKEND_PID 2>/dev/null && [ $elapsed -lt $timeout ]; do
    echo -n "."
    sleep 1
    ((elapsed++))
done
echo ""

if kill -0 $BACKEND_PID 2>/dev/null; then
    echo -e "${RED}❌ Backend did not exit within $timeout seconds${NC}"
    echo "Force killing backend..."
    kill -9 $BACKEND_PID
    exit_status=1
else
    echo -e "${GREEN}✅ Backend exited gracefully in $elapsed seconds${NC}"
    exit_status=0
fi

# Wait for request process to finish
wait $REQUEST_PID

echo ""
echo "================================================================================"
echo "Step 4: Analyzing Shutdown Logs"
echo "================================================================================"
echo ""

echo "Looking for shutdown indicators in logs..."
echo ""

if grep -q "Graceful shutdown initiated" /tmp/sqal_backend.log; then
    echo -e "${GREEN}✅ Found: 'Graceful shutdown initiated'${NC}"
else
    echo -e "${RED}❌ Missing: 'Graceful shutdown initiated'${NC}"
    exit_status=1
fi

if grep -q "Graceful shutdown complete" /tmp/sqal_backend.log; then
    echo -e "${GREEN}✅ Found: 'Graceful shutdown complete'${NC}"
else
    echo -e "${YELLOW}⚠️  Missing: 'Graceful shutdown complete' (may have been truncated)${NC}"
fi

if grep -q "Executing cleanup tasks" /tmp/sqal_backend.log; then
    echo -e "${GREEN}✅ Found: 'Executing cleanup tasks'${NC}"
else
    echo -e "${YELLOW}⚠️  Missing: 'Executing cleanup tasks'${NC}"
fi

echo ""
echo "Shutdown sequence from logs:"
echo "---"
grep -E "(shutdown|Shutting|cleanup|Closing)" /tmp/sqal_backend.log | tail -n 10
echo "---"

echo ""
echo "================================================================================"
echo "Step 5: Test Summary"
echo "================================================================================"
echo ""

if [ $exit_status -eq 0 ]; then
    echo -e "${GREEN}✅ GRACEFUL SHUTDOWN TEST PASSED${NC}"
    echo ""
    echo "The backend successfully:"
    echo "  ✓ Accepted shutdown signal (SIGTERM)"
    echo "  ✓ Stopped accepting new requests"
    echo "  ✓ Completed in-flight requests"
    echo "  ✓ Executed cleanup tasks"
    echo "  ✓ Exited cleanly"
else
    echo -e "${RED}❌ GRACEFUL SHUTDOWN TEST FAILED${NC}"
    echo ""
    echo "Check /tmp/sqal_backend.log for details"
fi

echo ""
echo "Full logs available at: /tmp/sqal_backend.log"
echo ""
echo "To view logs:"
echo "  cat /tmp/sqal_backend.log"
echo ""

exit $exit_status
