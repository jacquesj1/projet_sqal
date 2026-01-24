#!/bin/bash

echo "========================================"
echo "Starting Keycloak for Gaveurs System"
echo "========================================"

# Check if network exists, create if not
if ! docker network inspect gaveurs-network >/dev/null 2>&1; then
    echo "Creating Docker network: gaveurs-network"
    docker network create gaveurs-network
fi

# Start Keycloak
echo "Starting Keycloak services..."
docker-compose -f docker-compose.keycloak.yml up -d

echo ""
echo "========================================"
echo "Keycloak is starting..."
echo "========================================"
echo ""
echo "Access Keycloak Admin Console:"
echo "  URL: http://localhost:8080"
echo "  Username: admin"
echo "  Password: admin_secure_2024"
echo ""
echo "Waiting for Keycloak to be ready (60 seconds)..."
sleep 60

echo ""
echo "Check status with: docker-compose -f docker-compose.keycloak.yml ps"
echo "View logs with: docker logs -f gaveurs-keycloak"
echo ""
