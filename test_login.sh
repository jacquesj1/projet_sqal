#!/bin/bash

# Test login endpoint
echo "Testing /api/auth/login endpoint..."
echo ""

# Test 1: Avec credentials Keycloak admin
echo "Test 1: Admin Keycloak"
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin@euralis.fr", "password": "admin123"}' \
  -w "\nHTTP Status: %{http_code}\n" \
  -s | jq '.' 2>/dev/null || cat

echo ""
echo "---"
echo ""

# Test 2: Avec credentials superviseur
echo "Test 2: Superviseur"
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "superviseur@euralis.fr", "password": "super123"}' \
  -w "\nHTTP Status: %{http_code}\n" \
  -s | jq '.' 2>/dev/null || cat

echo ""
echo "---"
echo ""

# Test 3: Bad credentials
echo "Test 3: Bad credentials (devrait échouer)"
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "invalid@test.fr", "password": "wrongpass"}' \
  -w "\nHTTP Status: %{http_code}\n" \
  -s | jq '.' 2>/dev/null || cat

echo ""
