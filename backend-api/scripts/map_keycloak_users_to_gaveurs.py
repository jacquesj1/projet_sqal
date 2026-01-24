"""
Script pour mapper les utilisateurs Keycloak aux gaveurs dans la base de données

Ce script:
1. Récupère tous les gaveurs de la base
2. Crée/met à jour les utilisateurs correspondants dans Keycloak
3. Ajoute l'attribut custom 'gaveur_id' dans Keycloak

Usage:
    python scripts/map_keycloak_users_to_gaveurs.py
"""

import asyncio
import asyncpg
import os
from keycloak import KeycloakAdmin
from keycloak.exceptions import KeycloakGetError, KeycloakPostError

# Configuration
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://gaveurs_admin:gaveurs_secure_2024@localhost:5432/gaveurs_db")
KEYCLOAK_URL = os.getenv("KEYCLOAK_URL", "http://localhost:8080")
KEYCLOAK_ADMIN_USER = os.getenv("KEYCLOAK_ADMIN_USER", "admin")
KEYCLOAK_ADMIN_PASSWORD = os.getenv("KEYCLOAK_ADMIN_PASSWORD", "admin")
KEYCLOAK_REALM = os.getenv("KEYCLOAK_REALM", "gaveurs-production")

# Mot de passe par défaut pour les nouveaux utilisateurs
DEFAULT_PASSWORD = "gaveur123"


async def get_all_gaveurs():
    """Récupère tous les gaveurs de la base"""
    conn = await asyncpg.connect(DATABASE_URL)
    try:
        gaveurs = await conn.fetch("""
            SELECT id, nom, prenom, email, telephone, site_origine
            FROM gaveurs
            WHERE email IS NOT NULL AND email != ''
            ORDER BY id
        """)
        return [dict(g) for g in gaveurs]
    finally:
        await conn.close()


def create_or_update_keycloak_user(keycloak_admin, gaveur):
    """Crée ou met à jour un utilisateur Keycloak"""
    try:
        # Chercher l'utilisateur par email
        users = keycloak_admin.get_users({"email": gaveur['email']})

        user_data = {
            "email": gaveur['email'],
            "username": gaveur['email'],  # Use email as username
            "enabled": True,
            "emailVerified": True,
            "firstName": gaveur['prenom'],
            "lastName": gaveur['nom'],
            "attributes": {
                "gaveur_id": [str(gaveur['id'])],
                "site_origine": [gaveur['site_origine'] or ""],
                "telephone": [gaveur['telephone'] or ""]
            }
        }

        if users:
            # Utilisateur existe - UPDATE
            user_id = users[0]['id']
            keycloak_admin.update_user(user_id, user_data)
            print(f"[OK] Updated user: {gaveur['email']} (gaveur_id={gaveur['id']})")
            return user_id
        else:
            # Nouvel utilisateur - CREATE
            user_data["credentials"] = [{
                "type": "password",
                "value": DEFAULT_PASSWORD,
                "temporary": False  # Ne pas forcer le changement de mot de passe
            }]

            user_id = keycloak_admin.create_user(user_data)
            print(f"[OK] Created user: {gaveur['email']} (gaveur_id={gaveur['id']}, password={DEFAULT_PASSWORD})")
            return user_id

    except KeycloakPostError as e:
        print(f"[FAIL] Failed to create user {gaveur['email']}: {e}")
        return None
    except KeycloakGetError as e:
        print(f"[FAIL] Failed to get user {gaveur['email']}: {e}")
        return None
    except Exception as e:
        print(f"[FAIL] Unexpected error for {gaveur['email']}: {e}")
        return None


async def main():
    print("=" * 80)
    print("Mapping Keycloak users to Gaveurs database")
    print("=" * 80)

    # Connexion à Keycloak Admin
    print(f"\nConnecting to Keycloak: {KEYCLOAK_URL}")
    try:
        keycloak_admin = KeycloakAdmin(
            server_url=KEYCLOAK_URL,
            username=KEYCLOAK_ADMIN_USER,
            password=KEYCLOAK_ADMIN_PASSWORD,
            realm_name="master",  # Admin credentials are in master realm
            verify=True
        )

        # Switch to the gaveurs realm
        keycloak_admin.realm_name = KEYCLOAK_REALM
        print(f"[OK] Connected to realm: {KEYCLOAK_REALM}")

    except Exception as e:
        print(f"[FAIL] Failed to connect to Keycloak: {e}")
        print("\n⚠️  Make sure Keycloak is running: docker-compose ps keycloak")
        return

    # Récupérer les gaveurs
    print(f"\n Fetching gaveurs from database...")
    gaveurs = await get_all_gaveurs()
    print(f"Found {len(gaveurs)} gaveurs with email addresses")

    if not gaveurs:
        print("[FAIL] No gaveurs found in database")
        return

    # Créer/mettre à jour les utilisateurs
    print(f"\n Creating/updating Keycloak users...")
    success_count = 0
    failed_count = 0

    for gaveur in gaveurs:
        user_id = create_or_update_keycloak_user(keycloak_admin, gaveur)
        if user_id:
            success_count += 1
        else:
            failed_count += 1

    # Résumé
    print("\n" + "=" * 80)
    print(" Summary")
    print("=" * 80)
    print(f"[OK] Success: {success_count} users")
    print(f"[FAIL] Failed: {failed_count} users")
    print(f"\n Default password for all users: {DEFAULT_PASSWORD}")
    print("\n Users can now login with their email and password")
    print(f"   Example: {gaveurs[0]['email']} / {DEFAULT_PASSWORD}")
    print("\n" + "=" * 80)


if __name__ == "__main__":
    asyncio.run(main())
