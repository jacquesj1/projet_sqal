#!/bin/bash
# Cleanup obsolete directories
# Run this script: ./cleanup_dirs.sh

echo "Cleaning up obsolete directories..."

# Remove frontend (empty stub)
if [ -d "frontend" ]; then
    echo "Removing frontend/..."
    rm -rf frontend
fi

# Remove gaveurs (empty stub)
if [ -d "gaveurs" ]; then
    echo "Removing gaveurs/..."
    rm -rf gaveurs
fi

# Remove backend/venv first (if exists)
if [ -d "backend/venv" ]; then
    echo "Removing backend/venv/..."
    rm -rf backend/venv
fi

# Remove backend (empty stub)
if [ -d "backend" ]; then
    echo "Removing backend/..."
    rm -rf backend
fi

echo ""
echo "Cleanup complete!"
echo ""
echo "Remaining directories:"
ls -ld *backend* *frontend* *gaveurs* *euralis* 2>/dev/null || echo "None"
