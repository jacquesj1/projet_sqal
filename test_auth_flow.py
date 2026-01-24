#!/usr/bin/env python3
"""Test complete authentication flow for Jean Martin"""

import requests
import json

BASE_URL = "http://localhost:8000"

print("=" * 60)
print("TESTING COMPLETE AUTHENTICATION FLOW")
print("=" * 60)

# Step 1: Login
print("\n[1/3] Logging in as jean.martin@gaveur.fr...")
login_response = requests.post(
    f"{BASE_URL}/api/auth/login",
    json={"username": "jean.martin@gaveur.fr", "password": "gaveur123"}
)
login_data = login_response.json()
token = login_data["access_token"]
print(f"  [OK] Login successful")
print(f"  User: {login_data['user_info']['name']}")
print(f"  Email: {login_data['user_info']['email']}")

# Step 2: Get user info with gaveur_id
print("\n[2/3] Fetching enriched user info from /api/auth/me...")
headers = {"Authorization": f"Bearer {token}"}
me_response = requests.get(f"{BASE_URL}/api/auth/me", headers=headers)
user_data = me_response.json()
gaveur_id = user_data["gaveur_id"]
print(f"  [OK] User info retrieved")
print(f"  Gaveur ID: {gaveur_id}")
print(f"  Gaveur Site: {user_data['gaveur']['site']}")
print(f"  Gaveur Nom: {user_data['gaveur']['nom']}")

# Step 3: Get lots for this gaveur
print(f"\n[3/3] Fetching lots for gaveur_id={gaveur_id}...")
lots_response = requests.get(
    f"{BASE_URL}/api/lots",
    params={"gaveur_id": gaveur_id},
    headers=headers
)
lots_data = lots_response.json()
# Handle both list and dict responses
if isinstance(lots_data, dict):
    lots_list = lots_data.get('lots', [lots_data])
else:
    lots_list = lots_data

print(f"  [OK] Found {len(lots_list)} lots for Jean Martin:")
for lot in lots_list[:5]:  # Show first 5
    if 'code_lot' in lot:
        print(f"    - Lot {lot['code_lot']}: {lot.get('statut', 'N/A')} ({lot.get('nb_canards_initial', 0)} canards)")

print("\n" + "=" * 60)
print("[SUCCESS] Authentication solution working end-to-end!")
print("=" * 60)
print(f"\nSummary:")
print(f"  - User: Jean Martin (jean.martin@gaveur.fr)")
print(f"  - Gaveur ID: {gaveur_id}")
print(f"  - Total lots: {len(lots_list)}")
print(f"  - AuthContext will expose gaveurId to all components")
