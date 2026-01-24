#!/usr/bin/env python3
"""
================================================================================
EURALIS - Script d'Import des Données CSV
================================================================================
Description : Import des données historiques du fichier Pretraite_End_2024_claude.csv
              dans la base de données Euralis
Données     : 75 lots, 174 colonnes, 3 sites (LL, LS, MT)
Format CSV  : Séparateur ';', Encoding 'latin-1'
Date        : 2024-12-14
================================================================================
"""

import pandas as pd
import asyncpg
import os
import sys
from datetime import datetime, timedelta
import argparse
from pathlib import Path

# Configuration
DATABASE_URL = os.getenv('DATABASE_URL', 'postgresql://postgres:postgres@localhost:5432/gaveurs_db')


class EuralisDataImporter:
    """Importeur de données CSV Euralis"""

    def __init__(self, database_url: str):
        self.database_url = database_url
        self.conn = None

    async def connect(self):
        """Connexion à la base de données"""
        print("🔌 Connexion à la base de données...")
        self.conn = await asyncpg.connect(self.database_url)
        print("✅ Connecté à la base de données")

    async def disconnect(self):
        """Déconnexion de la base de données"""
        if self.conn:
            await self.conn.close()
            print("🔌 Déconnecté de la base de données")

    async def import_csv(self, csv_path: str):
        """
        Importer les données du CSV Euralis

        Args:
            csv_path: Chemin vers le fichier CSV
        """

        # 1. Lire le CSV
        print("\n" + "="*80)
        print("📄 LECTURE DU FICHIER CSV")
        print("="*80)

        if not Path(csv_path).exists():
            raise FileNotFoundError(f"Fichier CSV non trouvé : {csv_path}")

        print(f"Fichier : {csv_path}")

        df = pd.read_csv(csv_path, sep=';', encoding='latin-1')
        print(f"✅ {len(df)} lignes lues")
        print(f"✅ {len(df.columns)} colonnes")

        # Afficher les colonnes importantes
        print("\n📊 Colonnes détectées :")
        colonnes_importantes = ['CodeLot', 'Gaveur', 'Souche', 'ITM', 'Sigma', 'duree_gavage']
        for col in colonnes_importantes:
            if col in df.columns:
                print(f"   ✓ {col}")

        # 2. Vérifier les sites
        print("\n" + "="*80)
        print("🏢 ANALYSE DES SITES")
        print("="*80)

        # Extraire les codes sites depuis CodeLot
        df['site_code'] = df['CodeLot'].str[:2]

        sites_count = df['site_code'].value_counts()
        print(f"\nRépartition par site :")
        for site, count in sites_count.items():
            pct = count / len(df) * 100
            print(f"   {site} : {count} lots ({pct:.1f}%)")

        # 3. Créer/Vérifier les gaveurs
        print("\n" + "="*80)
        print("👨‍🌾 GESTION DES GAVEURS")
        print("="*80)

        gaveurs_uniques = df['Gaveur'].dropna().unique()
        print(f"Gaveurs uniques détectés : {len(gaveurs_uniques)}")

        gaveur_mapping = {}

        for gaveur_nom in gaveurs_uniques:
            # Vérifier si le gaveur existe déjà
            gaveur_id = await self.conn.fetchval(
                "SELECT id FROM gaveurs WHERE nom_usage = $1",
                gaveur_nom
            )

            if gaveur_id is None:
                # Créer le gaveur
                gaveur_id = await self.conn.fetchval(
                    """
                    INSERT INTO gaveurs (nom_usage, created_at)
                    VALUES ($1, NOW())
                    RETURNING id
                    """,
                    gaveur_nom
                )
                print(f"   ✅ Gaveur créé : {gaveur_nom} (ID: {gaveur_id})")
            else:
                print(f"   ℹ️  Gaveur existant : {gaveur_nom} (ID: {gaveur_id})")

            gaveur_mapping[gaveur_nom] = gaveur_id

        # 4. Importer les lots
        print("\n" + "="*80)
        print("📦 IMPORT DES LOTS DE GAVAGE")
        print("="*80)

        lots_imported = 0
        doses_imported = 0

        for idx, row in df.iterrows():
            try:
                code_lot = row['CodeLot']
                site_code = code_lot[:2]
                gaveur_nom = row['Gaveur']

                # Vérifier si le lot existe déjà
                lot_exists = await self.conn.fetchval(
                    "SELECT id FROM lots_gavage WHERE code_lot = $1",
                    code_lot
                )

                if lot_exists:
                    print(f"   ⏭️  Lot {code_lot} déjà importé")
                    continue

                gaveur_id = gaveur_mapping.get(gaveur_nom)

                # Calculer la date de début (utiliser Debut_du_lot si disponible)
                if 'Debut_du_lot' in row and pd.notna(row['Debut_du_lot']):
                    try:
                        debut_lot = pd.to_datetime(row['Debut_du_lot'])
                    except:
                        debut_lot = datetime(2024, 1, 1)
                else:
                    debut_lot = datetime(2024, 1, 1)

                # Créer le lot
                lot_data = {
                    'code_lot': code_lot,
                    'site_code': site_code,
                    'gaveur_id': gaveur_id,
                    'souche': row.get('Souche', ''),
                    'debut_lot': debut_lot,
                    'itm': float(row['ITM']) if pd.notna(row.get('ITM')) else None,
                    'sigma': float(row['Sigma']) if pd.notna(row.get('Sigma')) else None,
                    'duree_gavage_reelle': int(row['duree_gavage']) if pd.notna(row.get('duree_gavage')) else None,
                    'pctg_perte_gavage': float(row['dPctgPerteGav']) if pd.notna(row.get('dPctgPerteGav')) else None,
                    'total_corn_real': float(row['total_cornReal']) if pd.notna(row.get('total_cornReal')) else None,
                    'total_corn_target': float(row['total_cornTarget']) if pd.notna(row.get('total_cornTarget')) else None,
                    'nb_canards_meg': int(row['Nb_MEG']) if pd.notna(row.get('Nb_MEG')) else None,
                    'nb_canards_accroches': int(row['Quantite_accrochee']) if pd.notna(row.get('Quantite_accrochee')) else None,
                    'nb_canards_enleves': int(row['Nombre_enleve']) if pd.notna(row.get('Nombre_enleve')) else None,
                    'age_animaux': int(row['Age_des_animaux']) if pd.notna(row.get('Age_des_animaux')) else None,
                    'eleveur': row.get('Eleveur', ''),
                    'code_plan_alimentation': row.get('Code_plan_alimentation', ''),
                    'prod_igp_fr': bool(row.get('ProdIgpFR', False)),
                    'statut': 'termine'
                }

                # Insérer le lot
                lot_id = await self.conn.fetchval(
                    """
                    INSERT INTO lots_gavage (
                        code_lot, site_code, gaveur_id, souche, debut_lot,
                        itm, sigma, duree_gavage_reelle, pctg_perte_gavage,
                        total_corn_real, total_corn_target,
                        nb_canards_meg, nb_canards_accroches, nb_canards_enleves,
                        age_animaux, eleveur, code_plan_alimentation,
                        prod_igp_fr, statut
                    ) VALUES (
                        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
                        $15, $16, $17, $18, $19
                    ) RETURNING id
                    """,
                    lot_data['code_lot'], lot_data['site_code'], lot_data['gaveur_id'],
                    lot_data['souche'], lot_data['debut_lot'], lot_data['itm'],
                    lot_data['sigma'], lot_data['duree_gavage_reelle'],
                    lot_data['pctg_perte_gavage'], lot_data['total_corn_real'],
                    lot_data['total_corn_target'], lot_data['nb_canards_meg'],
                    lot_data['nb_canards_accroches'], lot_data['nb_canards_enleves'],
                    lot_data['age_animaux'], lot_data['eleveur'],
                    lot_data['code_plan_alimentation'], lot_data['prod_igp_fr'],
                    lot_data['statut']
                )

                lots_imported += 1

                # 5. Importer les doses journalières (jusqu'à 27 jours)
                for jour in range(1, 28):
                    col_real = f'feedCornReal_{jour}'
                    col_target = f'feedTarget_{jour}'
                    col_cumul = f'cumulCorn_{jour}'

                    if col_real in row and pd.notna(row[col_real]):
                        feed_real = float(row[col_real])
                        feed_target = float(row[col_target]) if col_target in row and pd.notna(row[col_target]) else None
                        cumul_corn = float(row[col_cumul]) if col_cumul in row and pd.notna(row[col_cumul]) else None

                        # Calculer la date pour ce jour de gavage
                        dose_date = debut_lot + timedelta(days=jour-1)

                        # Insérer la dose
                        await self.conn.execute(
                            """
                            INSERT INTO doses_journalieres (
                                time, lot_id, jour_gavage, feed_real, feed_target, cumul_corn
                            ) VALUES ($1, $2, $3, $4, $5, $6)
                            """,
                            dose_date, lot_id, jour, feed_real, feed_target, cumul_corn
                        )

                        doses_imported += 1

                if (idx + 1) % 10 == 0:
                    print(f"   📦 {idx + 1}/{len(df)} lots traités...")

            except Exception as e:
                print(f"   ❌ Erreur pour lot {row.get('CodeLot', 'INCONNU')} : {e}")
                continue

        print(f"\n✅ {lots_imported} lots importés")
        print(f"✅ {doses_imported} doses journalières importées")

        # 6. Refresh vue matérialisée
        print("\n" + "="*80)
        print("🔄 REFRESH VUE MATÉRIALISÉE")
        print("="*80)

        await self.conn.execute("REFRESH MATERIALIZED VIEW performances_sites")
        print("✅ Vue performances_sites rafraîchie")

        # 7. Statistiques finales
        print("\n" + "="*80)
        print("📊 STATISTIQUES FINALES")
        print("="*80)

        stats = await self.conn.fetch("""
            SELECT
                site_code,
                COUNT(*) as nb_lots,
                AVG(itm) as itm_moyen,
                AVG(pctg_perte_gavage) as mortalite_moyenne
            FROM lots_gavage
            GROUP BY site_code
            ORDER BY site_code
        """)

        print("\nRésumé par site :")
        for row in stats:
            print(f"   {row['site_code']} : {row['nb_lots']} lots | ITM moyen: {row['itm_moyen']:.2f} kg | Mortalité: {row['mortalite_moyenne']:.2f}%")

        print("\n" + "="*80)
        print("✅ IMPORT TERMINÉ AVEC SUCCÈS !")
        print("="*80)


async def main():
    """Fonction principale"""

    parser = argparse.ArgumentParser(description='Import des données CSV Euralis')
    parser.add_argument('csv_path', help='Chemin vers le fichier CSV')
    parser.add_argument('--db-url', default=DATABASE_URL, help='URL de la base de données')

    args = parser.parse_args()

    print("\n" + "="*80)
    print("🦆 EURALIS - IMPORT DES DONNÉES CSV")
    print("="*80)
    print(f"Fichier CSV : {args.csv_path}")
    print(f"Base de données : {args.db_url.split('@')[1] if '@' in args.db_url else args.db_url}")
    print("="*80)

    importer = EuralisDataImporter(args.db_url)

    try:
        await importer.connect()
        await importer.import_csv(args.csv_path)
    except Exception as e:
        print(f"\n❌ ERREUR : {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        await importer.disconnect()


if __name__ == '__main__':
    import asyncio
    asyncio.run(main())
