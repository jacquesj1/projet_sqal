"""
Script simple pour créer jean.martin@gaveur.fr dans PostgreSQL
Utilise psycopg2 ou psycopg (bibliothèques standard)
"""

import sys

# Essayer psycopg2 (ancien) ou psycopg (nouveau)
try:
    import psycopg2 as psycopg
    from psycopg2 import sql
    use_psycopg3 = False
except ImportError:
    try:
        import psycopg
        from psycopg import sql
        use_psycopg3 = True
    except ImportError:
        print("[ERROR] psycopg2 ou psycopg requis")
        print("Installez avec : pip install psycopg2-binary")
        sys.exit(1)

from datetime import datetime, timedelta

DATABASE_URL = "postgresql://gaveurs_admin:gaveurs_secure_2024@localhost:5432/gaveurs_db"


def create_test_gaveur():
    """Créer gaveur + lot + historique"""

    print("[*] Connexion a PostgreSQL...")

    try:
        if use_psycopg3:
            conn = psycopg.connect(DATABASE_URL)
        else:
            conn = psycopg.connect(DATABASE_URL)

        cursor = conn.cursor()

        # Vérifier si le gaveur existe
        cursor.execute(
            "SELECT id FROM gaveurs WHERE email = %s",
            ("jean.martin@gaveur.fr",)
        )
        existing = cursor.fetchone()

        if existing:
            print(f"[OK] Le gaveur jean.martin@gaveur.fr existe deja (id: {existing[0]})")
            cursor.close()
            conn.close()
            return

        # Créer le gaveur
        cursor.execute(
            """
            INSERT INTO gaveurs (nom, prenom, email, telephone, site_origine, actif, date_creation)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            RETURNING id
            """,
            ('Martin', 'Jean', 'jean.martin@gaveur.fr', '0612345678', 'LL', True, datetime.now())
        )
        gaveur_id = cursor.fetchone()[0]
        print(f"[OK] Gaveur cree : jean.martin@gaveur.fr (id: {gaveur_id})")

        # Créer un lot
        date_debut = datetime.now().date() - timedelta(days=12)

        cursor.execute(
            """
            INSERT INTO lots (
                code_lot, gaveur_id, site_origine, statut,
                nombre_canards, nombre_jours_gavage_ecoules,
                poids_moyen_actuel, objectif_poids_final,
                date_debut_gavage, date_creation
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id
            """,
            ('LL_TEST_042', gaveur_id, 'LL', 'en_gavage',
             200, 12, 4854, 5500,
             date_debut, datetime.now())
        )
        lot_id = cursor.fetchone()[0]
        print(f"[OK] Lot cree : LL_TEST_042 (id: {lot_id})")

        # Créer historique gavage (J1 à J12)
        gavage_count = 0
        for jour in range(1, 13):
            date_gavage = date_debut + timedelta(days=jour - 1)
            poids = 3500 + (jour * 100) + (jour % 3 * 10)
            dose = 150 + (jour * 5)

            cursor.execute(
                """
                INSERT INTO gavage_data (
                    lot_id, jour_gavage, date_gavage,
                    poids_moyen_mesure, nb_canards_peses,
                    dose_matin, dose_soir, remarques
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (lot_id, jour, date_gavage,
                 poids, 10,
                 dose, dose,
                 f'[TEST] Jour {jour}/14')
            )
            gavage_count += 1

        print(f"[OK] Donnees de gavage creees : {gavage_count} jours (J1-J12)")

        # Valider les changements
        conn.commit()

        # Vérifier le résultat
        cursor.execute(
            """
            SELECT
                g.id,
                g.prenom || ' ' || g.nom AS nom_complet,
                g.email,
                g.telephone,
                g.site_origine,
                (SELECT COUNT(*) FROM lots WHERE gaveur_id = g.id) AS nombre_lots
            FROM gaveurs g
            WHERE g.email = 'jean.martin@gaveur.fr'
            """
        )
        result = cursor.fetchone()

        print("\n[RESULTAT]")
        print(f"  ID: {result[0]}")
        print(f"  Nom: {result[1]}")
        print(f"  Email: {result[2]}")
        print(f"  Telephone: {result[3]}")
        print(f"  Site: {result[4]}")
        print(f"  Nombre de lots: {result[5]}")

        print("\n[SUCCESS] Creation reussie ! Vous pouvez maintenant vous connecter avec :")
        print("  Email: jean.martin@gaveur.fr")
        print("  Password: gaveur123")
        print("\nTestez avec:")
        print("  curl -X POST http://localhost:8000/api/auth/login \\")
        print("    -H 'Content-Type: application/json' \\")
        print('    -d \'{"username":"jean.martin@gaveur.fr","password":"gaveur123"}\'')

        cursor.close()
        conn.close()

    except Exception as e:
        print(f"[ERROR] Erreur : {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    create_test_gaveur()
