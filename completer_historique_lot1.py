"""
Script pour compléter l'historique manquant du lot 1
Crée les gavages J1 à J10 qui manquent
"""

import sys
try:
    import psycopg2 as psycopg
    use_psycopg3 = False
except ImportError:
    try:
        import psycopg
        use_psycopg3 = True
    except ImportError:
        print("[ERROR] psycopg2 ou psycopg requis")
        print("Installez avec : pip install psycopg2-binary")
        sys.exit(1)

from datetime import datetime, timedelta

DATABASE_URL = "postgresql://gaveurs_admin:gaveurs_secure_2024@localhost:5432/gaveurs_db"

def completer_historique():
    """Compléter les jours manquants J1 à J10 pour le lot 1"""

    print("[*] Connexion à PostgreSQL...")

    try:
        if use_psycopg3:
            conn = psycopg.connect(DATABASE_URL)
        else:
            conn = psycopg.connect(DATABASE_URL)

        cursor = conn.cursor()

        # Vérifier le lot
        cursor.execute("SELECT id, code_lot, date_debut_gavage FROM lots WHERE id = 1")
        lot = cursor.fetchone()

        if not lot:
            print("[ERROR] Lot 1 non trouvé")
            return

        lot_id, code_lot, date_debut = lot
        print(f"[OK] Lot trouvé : {code_lot} - Début: {date_debut}")

        # Vérifier les jours déjà existants
        cursor.execute(
            "SELECT jour_gavage FROM gavage_lot_quotidien WHERE lot_id = 1 ORDER BY jour_gavage"
        )
        jours_existants = set(row[0] for row in cursor.fetchall())
        print(f"[INFO] Jours déjà renseignés : {sorted(jours_existants)}")

        # Créer J1 à J10
        gavages_crees = 0

        for jour in range(1, 11):  # J1 à J10
            if jour in jours_existants:
                print(f"[SKIP] J{jour} déjà existant")
                continue

            # Calculer la date pour ce jour
            date_gavage = date_debut + timedelta(days=jour - 1)

            # Poids progressif : démarrage à 3500g, +70g par jour
            poids = 3500 + (jour * 70)

            # Dose progressive : démarrage à 140g, +5g par jour
            dose = 140 + (jour * 5)

            try:
                cursor.execute(
                    """
                    INSERT INTO gavage_lot_quotidien (
                        lot_id, jour_gavage, date_gavage,
                        poids_moyen_mesure, nb_canards_peses,
                        dose_matin, dose_soir,
                        heure_gavage_matin, heure_gavage_soir,
                        temperature_stabule, humidite_stabule,
                        suit_courbe_theorique, remarques
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """,
                    (lot_id, jour, date_gavage,
                     poids, 10,
                     dose, dose,
                     '08:30:00', '18:30:00',
                     22.0, 65.0,
                     True, f'[RATTRAPAGE] Historique complété automatiquement')
                )
                gavages_crees += 1
                print(f"[OK] J{jour} créé - {date_gavage} - {poids}g - {dose}g x2")
            except Exception as e:
                print(f"[ERROR] Erreur création J{jour}: {e}")

        # Commit
        conn.commit()

        print(f"\n[SUCCESS] {gavages_crees} gavages créés !")

        # Vérifier le résultat
        cursor.execute(
            """
            SELECT jour_gavage, date_gavage, poids_moyen_mesure, dose_matin
            FROM gavage_lot_quotidien
            WHERE lot_id = 1
            ORDER BY jour_gavage
            """
        )

        print("\n[HISTORIQUE COMPLET]")
        for row in cursor.fetchall():
            print(f"  J{row[0]:2d} - {row[1]} - {row[2]:6.1f}g - {row[3]:3.0f}g x2")

        cursor.close()
        conn.close()

    except Exception as e:
        print(f"[ERROR] Erreur : {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    completer_historique()
