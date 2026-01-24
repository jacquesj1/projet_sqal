"""
Créer un gaveur de test : jean.martin@gaveur.fr
Pour tester l'authentification sans Keycloak
"""

import asyncio
import asyncpg
import os
from datetime import datetime, timedelta

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://gaveurs_admin:gaveurs_secure_2024@localhost:5432/gaveurs_db"
)


async def create_test_gaveur():
    """Créer gaveur + lot + historique gavage"""

    print("🔌 Connexion à PostgreSQL...")
    conn = await asyncpg.connect(DATABASE_URL)

    try:
        # Vérifier si le gaveur existe
        existing = await conn.fetchrow(
            "SELECT id FROM gaveurs WHERE email = $1",
            "jean.martin@gaveur.fr"
        )

        if existing:
            print(f"✅ Le gaveur jean.martin@gaveur.fr existe déjà (id: {existing['id']})")
            return

        # Créer le gaveur
        gaveur_id = await conn.fetchval(
            """
            INSERT INTO gaveurs (nom, prenom, email, telephone, site_origine, actif, date_creation)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id
            """,
            'Martin', 'Jean', 'jean.martin@gaveur.fr', '0612345678', 'LL', True, datetime.now()
        )

        print(f"✅ Gaveur créé : jean.martin@gaveur.fr (id: {gaveur_id})")

        # Créer un lot
        date_debut = datetime.now().date() - timedelta(days=12)

        lot_id = await conn.fetchval(
            """
            INSERT INTO lots (
                code_lot, gaveur_id, site_origine, statut,
                nombre_canards, nombre_jours_gavage_ecoules,
                poids_moyen_actuel, objectif_poids_final,
                date_debut_gavage, date_creation
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING id
            """,
            'LL_TEST_042', gaveur_id, 'LL', 'en_gavage',
            200, 12, 4854, 5500,
            date_debut, datetime.now()
        )

        print(f"✅ Lot créé : LL_TEST_042 (id: {lot_id})")

        # Créer historique gavage (J1 à J12)
        gavage_count = 0
        for jour in range(1, 13):
            date_gavage = date_debut + timedelta(days=jour - 1)
            poids = 3500 + (jour * 100) + (jour % 3 * 10)  # Progression réaliste
            dose = 150 + (jour * 5)

            await conn.execute(
                """
                INSERT INTO gavage_data (
                    lot_id, jour_gavage, date_gavage,
                    poids_moyen_mesure, nb_canards_peses,
                    dose_matin, dose_soir, remarques
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                """,
                lot_id, jour, date_gavage,
                poids, 10,
                dose, dose,
                f'[TEST] Jour {jour}/14'
            )
            gavage_count += 1

        print(f"✅ Données de gavage créées : {gavage_count} jours (J1-J12)")

        # Vérifier le résultat
        result = await conn.fetchrow(
            """
            SELECT
                g.id,
                g.prenom || ' ' || g.nom AS nom_complet,
                g.email,
                g.telephone,
                g.site_origine,
                COUNT(l.id) AS nombre_lots
            FROM gaveurs g
            LEFT JOIN lots l ON g.id = l.gaveur_id
            WHERE g.email = 'jean.martin@gaveur.fr'
            GROUP BY g.id, g.prenom, g.nom, g.email, g.telephone, g.site_origine
            """
        )

        print("\n📊 Résultat :")
        print(f"  ID: {result['id']}")
        print(f"  Nom: {result['nom_complet']}")
        print(f"  Email: {result['email']}")
        print(f"  Téléphone: {result['telephone']}")
        print(f"  Site: {result['site_origine']}")
        print(f"  Nombre de lots: {result['nombre_lots']}")

        print("\n🎉 Création réussie ! Vous pouvez maintenant vous connecter avec :")
        print("  Email: jean.martin@gaveur.fr")
        print("  Password: gaveur123")

    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(create_test_gaveur())
