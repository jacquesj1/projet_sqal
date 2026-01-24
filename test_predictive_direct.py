#!/usr/bin/env python3
"""
Test direct de l'endpoint predictive pour débugger l'erreur 500
"""
import asyncio
import asyncpg
import json
from os import environ

DATABASE_URL = environ.get('DATABASE_URL', 'postgresql://gaveurs_admin:gaveurs_secure_2024@localhost:5432/gaveurs_db')

async def test_predictive_endpoint(lot_id: int = 3468):
    """
    Réplique la logique de l'endpoint /api/courbes/predictive/lot/{lot_id}
    """
    conn = await asyncpg.connect(DATABASE_URL)

    try:
        print(f"\n🔍 Test endpoint predictive pour lot {lot_id}\n")

        # 1. Récupérer courbe théorique
        print("1️⃣ Récupération courbe théorique...")
        courbe_theo = await conn.fetchrow("""
            SELECT id, courbe_theorique, courbe_modifiee, duree_gavage_jours
            FROM courbes_gavage_optimales
            WHERE lot_id = $1 AND statut IN ('VALIDEE', 'MODIFIEE')
            ORDER BY created_at DESC LIMIT 1
        """, lot_id)

        if not courbe_theo:
            print(f"❌ Erreur: Courbe théorique non trouvée pour lot {lot_id}")
            return

        print(f"✅ Courbe trouvée (ID: {courbe_theo['id']}, durée: {courbe_theo['duree_gavage_jours']} jours)")

        # Parser la courbe théorique
        courbe_ref = courbe_theo['courbe_modifiee'] or courbe_theo['courbe_theorique']
        if isinstance(courbe_ref, str):
            courbe_ref = json.loads(courbe_ref)

        duree_totale = courbe_theo['duree_gavage_jours']
        print(f"   Courbe de référence: {len(courbe_ref)} points")

        # 2. Récupérer doses réelles
        print("\n2️⃣ Récupération doses réelles...")
        doses_reelles = await conn.fetch("""
            SELECT jour_gavage, dose_reelle_g, dose_theorique_g, ecart_pct, alerte_ecart
            FROM courbe_reelle_quotidienne
            WHERE lot_id = $1
            ORDER BY jour_gavage
        """, lot_id)

        print(f"✅ {len(doses_reelles)} doses réelles trouvées")

        # 3. Calculer courbe prédictive
        print("\n3️⃣ Calcul courbe prédictive...")
        courbe_predictive = []
        a_des_alertes = False
        dernier_jour_reel = 0

        if not doses_reelles:
            print("   Pas de données réelles → courbe prédictive = courbe théorique")
            courbe_predictive = courbe_ref
        else:
            # Analyser les écarts
            dernier_jour = doses_reelles[-1]['jour_gavage']
            derniere_dose_reelle = doses_reelles[-1]['dose_reelle_g']
            derniere_dose_theo = doses_reelles[-1]['dose_theorique_g']
            dernier_jour_reel = dernier_jour

            print(f"   Dernier jour gavé: {dernier_jour}")
            print(f"   Dernière dose réelle: {derniere_dose_reelle}g")
            print(f"   Dernière dose théorique: {derniere_dose_theo}g")

            # Calculer écart cumulé
            ecart_cumule = derniere_dose_reelle - derniere_dose_theo
            a_des_alertes = any(d['alerte_ecart'] for d in doses_reelles)

            print(f"   Écart cumulé: {ecart_cumule}g")
            print(f"   A des alertes: {a_des_alertes}")

            # Dose finale théorique
            dose_finale_theo = courbe_ref[-1]['dose_g']
            jours_restants = duree_totale - dernier_jour

            print(f"   Dose finale théorique: {dose_finale_theo}g")
            print(f"   Jours restants: {jours_restants}")

            if not a_des_alertes or abs(ecart_cumule) < 10:
                print("   → Pas d'écart significatif → suivre courbe théorique")
                courbe_predictive = courbe_ref
            else:
                print("   → Écart significatif détecté → calcul trajectoire corrective")

                # Copier les points passés
                for jour in range(1, dernier_jour + 1):
                    dose_jour = next((d['dose_reelle_g'] for d in doses_reelles if d['jour_gavage'] == jour), None)
                    if dose_jour:
                        courbe_predictive.append({"jour": jour, "dose_g": dose_jour})
                    else:
                        dose_theo = next((c['dose_g'] for c in courbe_ref if c['jour'] == jour), 0)
                        courbe_predictive.append({"jour": jour, "dose_g": dose_theo})

                # Calculer pente de rattrapage
                if jours_restants > 0:
                    increment_moyen = (dose_finale_theo - derniere_dose_reelle) / jours_restants
                    print(f"   Incrément moyen de rattrapage: {increment_moyen}g/jour")

                    for jour in range(dernier_jour + 1, duree_totale + 1):
                        jours_depuis_dernier = jour - dernier_jour
                        dose_predictive = derniere_dose_reelle + (increment_moyen * jours_depuis_dernier)

                        dose_theo_jour = next((c['dose_g'] for c in courbe_ref if c['jour'] == jour), dose_predictive)
                        dose_lissee = dose_predictive * 0.8 + dose_theo_jour * 0.2

                        courbe_predictive.append({"jour": jour, "dose_g": round(dose_lissee, 1)})
                else:
                    courbe_predictive.append({"jour": duree_totale, "dose_g": dose_finale_theo})

        # Résultat final
        result = {
            'lot_id': lot_id,
            'courbe_predictive': courbe_predictive,
            'dernier_jour_reel': dernier_jour_reel,
            'a_des_ecarts': a_des_alertes,
            'algorithme': 'correction_lineaire_lissee' if a_des_alertes else 'courbe_theorique'
        }

        print(f"\n✅ SUCCESS - Résultat:")
        print(f"   Lot: {result['lot_id']}")
        print(f"   Points courbe: {len(result['courbe_predictive'])}")
        print(f"   Dernier jour réel: {result['dernier_jour_reel']}")
        print(f"   A des écarts: {result['a_des_ecarts']}")
        print(f"   Algorithme: {result['algorithme']}")

        # Afficher premiers points
        print(f"\n   Premiers points courbe prédictive:")
        for i, point in enumerate(result['courbe_predictive'][:5]):
            print(f"      Jour {point['jour']}: {point['dose_g']}g")

        return result

    except Exception as e:
        print(f"\n❌ ERREUR: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()

    finally:
        await conn.close()

if __name__ == '__main__':
    asyncio.run(test_predictive_endpoint(3468))
