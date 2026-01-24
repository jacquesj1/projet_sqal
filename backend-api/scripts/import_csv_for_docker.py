#!/usr/bin/env python3
"""
Import CSV - Version pour exécution dans conteneur Docker
Chemin CSV: /app/data.csv
Database: gaveurs_timescaledb (nom du conteneur)
"""

import asyncio
import asyncpg
import csv
import sys
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Optional

# Fix Windows encoding
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')

# Configuration pour Docker
DATABASE_URL = "postgresql://gaveurs_admin:gaveurs_secure_2024@gaveurs_timescaledb:5432/gaveurs_db"
CSV_PATH = "/app/data.csv"

# Mapping souche CSV → souche DB
SOUCHE_MAPPING = {
    "CF80* - M15 V2E SFM": "mulard",
    "MMG AS - PKL*": "mulard",
}

# Mapping site CSV → site DB
SITE_MAPPING = {
    "BRETAGNE": "Bretagne",
    "SUDOUEST": "SudOuest",
}


def parse_int(value: str) -> Optional[int]:
    """Parse un entier depuis CSV"""
    if not value or value == "nan" or value == "":
        return None
    try:
        return int(float(value))
    except:
        return None


def parse_decimal(value: str) -> Optional[Decimal]:
    """Parse un décimal depuis CSV"""
    if not value or value == "nan" or value == "":
        return None
    try:
        # Remplacer virgule par point
        value_clean = value.replace(",", ".")
        return Decimal(value_clean)
    except:
        return None


def parse_date(value: str) -> Optional[datetime]:
    """Parse une date depuis CSV (formats: DD/MM/YYYY ou YYYY-MM-DD HH:MM:SS)"""
    if not value or value == "nan" or value == "":
        return None
    try:
        # Essayer format DD/MM/YYYY d'abord
        return datetime.strptime(value, "%d/%m/%Y")
    except:
        try:
            # Essayer format YYYY-MM-DD HH:MM:SS
            return datetime.strptime(value, "%Y-%m-%d %H:%M:%S")
        except:
            try:
                # Essayer format YYYY-MM-DD
                return datetime.strptime(value, "%Y-%m-%d")
            except:
                return None


def get_souche(souche_csv: str) -> str:
    """Mapper souche CSV vers souche DB"""
    for pattern, souche_db in SOUCHE_MAPPING.items():
        if pattern in souche_csv:
            return souche_db
    return "mulard"  # Par défaut


def get_site(geo_csv: str) -> str:
    """Mapper GEO CSV vers site DB"""
    geo_upper = geo_csv.upper()
    for pattern, site_db in SITE_MAPPING.items():
        if pattern in geo_upper:
            return site_db
    return "Autre"


async def create_gaveur_if_not_exists(conn, nom_gaveur: str) -> int:
    """Créer un gaveur s'il n'existe pas, retourner son ID"""
    gaveur_id = await conn.fetchval(
        "SELECT id FROM gaveurs_euralis WHERE nom = $1", nom_gaveur
    )

    if gaveur_id:
        return gaveur_id

    gaveur_id = await conn.fetchval(
        """
        INSERT INTO gaveurs_euralis (nom, created_at)
        VALUES ($1, NOW())
        RETURNING id
        """,
        nom_gaveur
    )

    print(f"   Gaveur '{nom_gaveur}' créé (ID: {gaveur_id})")
    return gaveur_id


async def import_lot(conn, row: dict, dry_run: bool = False):
    """Importer un lot depuis une ligne CSV"""
    code_lot = row.get("Code_lot")
    if not code_lot:
        return None

    # Gaveur
    nom_gaveur = row.get("Gaveur", "")
    if dry_run:
        gaveur_id = 1  # Fake ID pour dry-run
    else:
        gaveur_id = await create_gaveur_if_not_exists(conn, nom_gaveur)

    # Dates
    date_debut = parse_date(row["Debut_du_lot"])
    if not date_debut:
        print(f"⚠️  Lot {code_lot}: Date début manquante, skip")
        return None

    duree_gavage = parse_int(row.get("Duree_du_lot")) or 11
    date_fin = date_debut + timedelta(days=duree_gavage)

    # Métadonnées
    souche = get_souche(row.get("Souche", ""))
    site_origine = get_site(row.get("GEO", ""))
    nombre_canards = parse_int(row.get("Quantite_accrochee")) or 1000

    # ITM et Sigma
    itm = parse_decimal(row.get("ITM"))
    sigma = parse_decimal(row.get("Sigma"))

    # Doses et mortalité
    dose_totale = parse_decimal(row.get("total_cornReal"))
    nb_meg = parse_int(row.get("Nb_MEG")) or 0
    poids_foie_moyen = parse_decimal(row.get("Poids_de_foies_moyen"))

    # Poids estimés
    poids_initial = 4500
    poids_final = 6500

    if dry_run:
        print(f"✅ [DRY-RUN] Lot {code_lot}:")
        print(f"   - Date: {date_debut.date()} → {date_fin.date()} ({duree_gavage}j)")
        print(f"   - Canards: {nombre_canards} | Souche: {souche} | Site: {site_origine}")
        print(f"   - Gaveur: {nom_gaveur} (ID: {gaveur_id})")
        print(f"   - ITM: {itm} | Sigma: {sigma} | Poids foie: {poids_foie_moyen}g")
        print(f"   - Dose totale: {dose_totale}g | Morts: {nb_meg}")
        return (None, code_lot, duree_gavage)

    # Vérifier si le lot existe déjà
    existing = await conn.fetchval(
        "SELECT id FROM lots_gavage WHERE code_lot = $1", code_lot
    )

    if existing:
        print(f"⚠️  Lot {code_lot} existe déjà (ID: {existing}), skip")
        return None

    # Insérer le lot
    try:
        lot_id = await conn.fetchval("""
            INSERT INTO lots_gavage (
                code_lot, gaveur_id, geo, souche,
                nb_accroches, debut_lot,
                duree_du_lot, itm, sigma,
                total_corn_real_g, nb_meg, poids_foie_moyen_g,
                statut, created_at
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW()
            )
            RETURNING id
        """,
            code_lot, gaveur_id, site_origine, souche,
            nombre_canards, date_debut,
            duree_gavage, itm, sigma,
            dose_totale, nb_meg, poids_foie_moyen,
            "termine"
        )

        print(f"✅ Lot {code_lot} créé (ID: {lot_id})")
        return (lot_id, code_lot, duree_gavage)

    except Exception as e:
        print(f"❌ Erreur insertion lot {code_lot}: {e}")
        return None


async def main(dry_run: bool = False):
    """Point d'entrée principal"""
    print("=" * 80)
    print("IMPORT DONNÉES RÉELLES CSV → BASE DE DONNÉES")
    print("=" * 80)
    print()

    if dry_run:
        print("⚠️  MODE DRY-RUN: Aucune insertion en base")
        print()

    print(f"📂 Fichier CSV: {CSV_PATH}")

    # Connexion DB
    if dry_run:
        print(f"🔌 Connexion DB: SKIP (dry-run)")
        print()
        conn = None
    else:
        try:
            conn = await asyncpg.connect(DATABASE_URL)
            print(f"🔌 Connexion DB: OK")
            print()
        except Exception as e:
            print(f"❌ Erreur connexion DB: {e}")
            return

    # Lire CSV
    lots_imported = 0
    lots_skipped = 0

    try:
        with open(CSV_PATH, 'r', encoding='latin-1') as f:
            reader = csv.DictReader(f, delimiter=';')

            print("📋 Lecture CSV...")
            rows = list(reader)
            print(f"   {len(rows)} lots trouvés\n")

            for idx, row in enumerate(rows, 1):
                code_lot = row.get("Code_lot", f"UNKNOWN_{idx}")

                print(f"[{idx}/{len(rows)}] Traitement lot {code_lot}...")

                result = await import_lot(conn, row, dry_run=dry_run)

                if result:
                    lots_imported += 1
                else:
                    lots_skipped += 1

                print()

    except FileNotFoundError:
        print(f"❌ Fichier CSV non trouvé: {CSV_PATH}")
        return
    except Exception as e:
        print(f"❌ Erreur lecture CSV: {e}")
        import traceback
        traceback.print_exc()
        return
    finally:
        if conn:
            await conn.close()

    # Résumé
    print("=" * 80)
    print("RÉSUMÉ IMPORT")
    print("=" * 80)
    print(f"✅ Lots importés: {lots_imported}")
    print(f"⚠️  Lots skippés: {lots_skipped}")
    print()

    if dry_run:
        print("💡 Pour importer réellement, relancer sans --dry-run")
    else:
        print("🎉 Import terminé avec succès!")


if __name__ == "__main__":
    import sys
    dry_run = "--dry-run" in sys.argv
    asyncio.run(main(dry_run=dry_run))
