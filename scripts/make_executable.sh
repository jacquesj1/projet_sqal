#!/bin/bash
# ==============================================================================
# Make All Scripts Executable (Linux/macOS)
# ==============================================================================
# This script makes all .sh scripts executable
# Usage: ./scripts/make_executable.sh
# ==============================================================================

# Get the directory where the script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Making all .sh scripts executable..."

# Make all .sh files in scripts directory executable
chmod +x "$SCRIPT_DIR"/*.sh

# Make all Python scripts executable
chmod +x "$SCRIPT_DIR"/*.py

echo "✓ All scripts are now executable!"

# List executable scripts
echo ""
echo "Executable scripts:"
ls -lh "$SCRIPT_DIR"/*.sh "$SCRIPT_DIR"/*.py 2>/dev/null | awk '{print "  " $9}'

echo ""
echo "You can now run scripts with:"
echo "  ./scripts/build.sh all"
echo "  ./scripts/start.sh all"
echo "  ./scripts/stop.sh all"
echo "  ./scripts/run_tests.sh all"
echo "  python scripts/health_check.py"
echo "  python scripts/db_migrate.py"
echo "  python scripts/generate_test_data.py"
