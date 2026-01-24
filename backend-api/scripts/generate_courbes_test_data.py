"""
Génère des données de test pour le workflow PySR 3-courbes
"""
import asyncio
import asyncpg
import os
import json
from datetime import date, timedelta

DATABASE_URL = os.getenv(
    'DATABASE_URL',
    'postgresql://gaveurs_admin:gaveurs_secure_2024@localhost:5432/gaveurs_db'
)

async def generate_test_data():
    """Génère données complètes workflow 3-courbes"""
    print("[*] Connexion database...")
    conn = await asyncpg.connect(DATABASE_URL, ssl=False)

    try:
        # 1. Récupérer un lot existant
        lot = await conn.fetchrow("""
            SELECT id, code_lot, gaveur_id, site_code, debut_lot
            FROM lots_gavage
            WHERE statut = 'en_cours'
            LIMIT 1
        """)

        if not lot:
            print("[WARN] Aucun lot en cours trouvé. Création d'un nouveau lot...")
            # Créer un lot de test
            gaveur = await conn.fetchrow("SELECT id, site_code FROM gaveurs_euralis LIMIT 1")
            if not gaveur:
                print("[ERROR] Aucun gaveur trouvé!")
                return

            lot = await conn.fetchrow("""
                INSERT INTO lots_gavage (
                    code_lot, site_code, gaveur_id,
                    debut_lot, statut, souche, nb_accroches
                ) VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING id, code_lot, gaveur_id, site_code, debut_lot
            """,
                f"TEST_3COURBES_{date.today().strftime('%Y%m%d')}",
                gaveur['site_code'],
                gaveur['id'],
                date.today() - timedelta(days=5),  # Commencé il y a 5 jours
                'en_cours',
                'mulard',
                240
            )
            print(f"[OK] Lot créé: {lot['code_lot']}")

        print(f"\n[*] Lot: {lot['code_lot']} (ID: {lot['id']})")
        print(f"    Gaveur ID: {lot['gaveur_id']}")
        print(f"    Site: {lot['site_code']}")

        # 2. Générer courbe théorique PySR
        print("\n[*] Génération courbe théorique PySR...")

        # Courbe théorique: croissance progressive sur 14 jours
        courbe_theorique = []
        for jour in range(1, 15):
            # Formule réaliste: dose augmente progressivement puis stagne
            if jour <= 3:
                dose = 120 + (jour - 1) * 25  # 120, 145, 170
            elif jour <= 8:
                dose = 170 + (jour - 3) * 20  # 190, 210, 230, 250, 270
            else:
                dose = 270 + (jour - 8) * 5   # 275, 280, 285, 290, 295, 300

            courbe_theorique.append({
                'jour': jour,
                'dose_g': round(dose, 1)
            })

        courbe_id = await conn.fetchval("""
            INSERT INTO courbes_gavage_optimales (
                lot_id, gaveur_id, site_code,
                pysr_equation,
                pysr_r2_score,
                pysr_complexity,
                courbe_theorique,
                duree_gavage_jours,
                statut
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING id
        """,
            lot['id'],
            lot['gaveur_id'],
            lot['site_code'],
            "120 + 25*min(jour-1, 2) + 20*max(0, min(jour-3, 5)) + 5*max(0, jour-8)",
            0.9456,  # R² score
            12,       # Complexity
            json.dumps(courbe_theorique),
            14,
            'EN_ATTENTE'  # En attente validation superviseur
        )

        print(f"[OK] Courbe théorique créée (ID: {courbe_id})")
        print(f"     Équation PySR: 120 + 25*min(jour-1, 2) + ...")
        print(f"     R² = 0.9456")

        # 3. Simuler validation superviseur
        print("\n[*] Simulation validation superviseur...")

        await conn.execute("""
            UPDATE courbes_gavage_optimales
            SET
                statut = 'VALIDEE',
                superviseur_nom = 'Jean Dupont (Test)',
                date_validation = NOW(),
                commentaire_superviseur = 'Courbe validée - Très bonne progression théorique'
            WHERE id = $1
        """, courbe_id)

        print("[OK] Courbe VALIDEE par superviseur")

        # 4. Générer doses réelles quotidiennes (jours 1-5)
        print("\n[*] Génération doses réelles (jours 1-5)...")

        debut_lot = lot['debut_lot']
        doses_reelles = [
            (1, 120, "OK"),
            (2, 140, "Léger sous-dosage"),  # -5g vs théorique (145)
            (3, 180, "Légèrement sur-dosé"), # +10g vs théorique (170)
            (4, 185, "Sous-dosage significatif"),  # -5g vs 190
            (5, 220, "Rattrapage en cours")  # +10g vs 210 pour compenser
        ]

        for jour, dose_reelle, commentaire in doses_reelles:
            date_gavage = debut_lot + timedelta(days=jour - 1)

            await conn.execute("""
                INSERT INTO courbe_reelle_quotidienne (
                    lot_id, gaveur_id, site_code,
                    date_gavage, jour_gavage, dose_reelle_g,
                    courbe_optimale_id, commentaire_gaveur
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                ON CONFLICT (lot_id, jour_gavage, date_gavage) DO NOTHING
            """,
                lot['id'],
                lot['gaveur_id'],
                lot['site_code'],
                date_gavage,
                jour,
                dose_reelle,
                courbe_id,
                commentaire
            )

        print(f"[OK] 5 doses réelles saisies")

        # 5. Vérifier écarts et corrections générées
        print("\n[*] Vérification écarts détectés...")

        ecarts = await conn.fetch("""
            SELECT
                jour_gavage,
                dose_reelle_g,
                dose_theorique_g,
                ecart_g,
                ecart_pct,
                alerte_ecart
            FROM courbe_reelle_quotidienne
            WHERE lot_id = $1
            ORDER BY jour_gavage
        """, lot['id'])

        nb_alertes = 0
        for row in ecarts:
            status = "[ALERTE]" if row['alerte_ecart'] else "[OK]"
            print(f"  {status} Jour {row['jour_gavage']}: "
                  f"Réel={row['dose_reelle_g']}g, "
                  f"Théo={row['dose_theorique_g']}g, "
                  f"Écart={row['ecart_pct']:.1f}%")
            if row['alerte_ecart']:
                nb_alertes += 1

        print(f"\n[INFO] {nb_alertes} alertes d'écart détectées")

        # 6. Tester endpoint dashboard
        print("\n[*] Test endpoint dashboard 3-courbes...")

        # Simuler appel API via requête directe
        dashboard = await conn.fetchrow("""
            SELECT
                nb_jours_saisis,
                ecart_moyen_pct,
                ecart_max_pct,
                nb_alertes_ecart
            FROM dashboard_courbes_gaveur
            WHERE lot_id = $1
        """, lot['id'])

        if not dashboard:
            # Refresh materialized view
            await conn.execute("REFRESH MATERIALIZED VIEW dashboard_courbes_gaveur")
            dashboard = await conn.fetchrow("""
                SELECT
                    nb_jours_saisis,
                    ecart_moyen_pct,
                    ecart_max_pct,
                    nb_alertes_ecart
                FROM dashboard_courbes_gaveur
                WHERE lot_id = $1
            """, lot['id'])

        if dashboard:
            print(f"[OK] Dashboard statistiques:")
            print(f"     Jours saisis: {dashboard['nb_jours_saisis']}")
            print(f"     Écart moyen: {dashboard['ecart_moyen_pct']:.2f}%")
            print(f"     Écart max: {dashboard['ecart_max_pct']:.2f}%")
            print(f"     Alertes: {dashboard['nb_alertes_ecart']}")

        # 7. Résumé final
        print("\n" + "="*60)
        print("[SUCCESS] Données de test générées !")
        print("="*60)
        print(f"\nPour tester l'API:")
        print(f"  GET /api/courbes/theorique/lot/{lot['id']}")
        print(f"  GET /api/courbes/reelle/lot/{lot['id']}")
        print(f"  GET /api/courbes/dashboard/lot/{lot['id']}")
        print(f"\nLot ID: {lot['id']}")
        print(f"Code lot: {lot['code_lot']}")

    except Exception as e:
        print(f"\n[ERROR] {e}")
        import traceback
        traceback.print_exc()
    finally:
        await conn.close()
        print("\n[*] Connexion fermee")

if __name__ == '__main__':
    asyncio.run(generate_test_data())
