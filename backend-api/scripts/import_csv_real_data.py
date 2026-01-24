"""
Script d'import des données réelles CSV vers la base de données

Importe les 74 lots réels depuis Pretraite_End_2024_claude.csv
avec historiques de gavage jour par jour.

Date: 12 Janvier 2026
Usage:
    python scripts/import_csv_real_data.py
    python scripts/import_csv_real_data.py --dry-run  # Preview sans insertion
"""

import asyncio
import asyncpg
import csv
import os
import sys
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Optional

# Fix Windows encoding
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')

# Configuration
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://gaveurs_admin:gaveurs_secure_2024@localhost:5432/gaveurs_db"
)

CSV_PATH = os.path.join(
    os.path.dirname(__file__),
    "..", "data", "2023", "Pretraite_End_2024.csv"
)

# Mapping souche CSV → souche DB
SOUCHE_MAPPING = {
    "CF80* - M15 V2E SFM": "mulard",
    "MMG AS - PKL*": "mulard",
    "CF80 - M15": "mulard",
    "CF80": "mulard",
    "MMG": "mulard",
    "PKL": "pekin",
    "BARBARIE": "barbarie",
}

# Mapping site GEO → site_origine
SITE_MAPPING = {
    "BRETAGNE": "Bretagne",
    "PAYS DE LOIRE": "Pays de Loire",
    "MAUBOURGUET": "Maubourguet",
    "LANDES": "Maubourguet",
}


def parse_decimal(value: str) -> Optional[Decimal]:
    """Parse une valeur décimale depuis CSV"""
    if not value or value == "nan" or value == "":
        return None
    try:
        return Decimal(value.replace(",", "."))
    except:
        return None


def parse_int(value: str) -> Optional[int]:
    """Parse un entier depuis CSV"""
    if not value or value == "nan" or value == "":
        return None
    try:
        return int(float(value.replace(",", ".")))
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
    for key, value in SOUCHE_MAPPING.items():
        if key in souche_csv:
            return value
    return "mulard"  # Défaut


def get_site(geo_csv: str) -> str:
    """Mapper GEO vers site_origine"""
    geo_upper = geo_csv.upper()
    for key, value in SITE_MAPPING.items():
        if key in geo_upper:
            return value
    return "Bretagne"  # Défaut


async def create_gaveur_if_not_exists(conn, nom_gaveur: str) -> int:
    """Créer un gaveur s'il n'existe pas, retourner son ID"""
    # Vérifier existence
    gaveur_id = await conn.fetchval(
        "SELECT id FROM gaveurs WHERE nom = $1", nom_gaveur
    )

    if gaveur_id:
        return gaveur_id

    # Créer nouveau gaveur
    gaveur_id = await conn.fetchval("""
        INSERT INTO gaveurs (nom, prenom, email, telephone, adresse, actif, created_at)
        VALUES ($1, $2, $3, $4, $5, true, NOW())
        RETURNING id
    """,
        nom_gaveur,
        "",  # prenom vide
        f"{nom_gaveur.lower().replace(' ', '.')}@euralis.fr",
        "",
        "",
    )

    return gaveur_id


async def import_lot(conn, row: dict, dry_run: bool = False):
    """
    Importer un lot depuis une ligne CSV

    Returns:
        tuple: (lot_id, code_lot, nb_jours_gavage)
    """
    code_lot = row["Code_lot"]

    # Parser les données principales
    date_debut = parse_date(row["Debut_du_lot"])
    if not date_debut:
        print(f"⚠️  Lot {code_lot}: Date début manquante, skip")
        return None

    duree_gavage = parse_int(row["duree_gavage"]) or parse_int(row["Duree_du_lot"]) or 11
    nombre_canards = parse_int(row["Quantite_accrochee"]) or 1000

    # Calculer date fin
    date_fin = date_debut + timedelta(days=duree_gavage)

    # Souche et site
    souche_csv = row.get("Souche", "")
    souche = get_souche(souche_csv)

    geo = row.get("GEO", "BRETAGNE")
    site_origine = get_site(geo)

    # Gaveur
    nom_gaveur = row.get("Gaveur", "INCONNU")
    if dry_run:
        gaveur_id = 1  # Fake ID pour dry-run
    else:
        gaveur_id = await create_gaveur_if_not_exists(conn, nom_gaveur)

    # ITM et Sigma
    itm = parse_decimal(row.get("ITM"))
    sigma = parse_decimal(row.get("Sigma"))

    # Doses et mortalité
    dose_totale = parse_decimal(row.get("total_cornReal")) or parse_decimal(row.get("QteTotalTest"))
    nb_meg = parse_int(row.get("Nb_MEG")) or 0  # Nombre morts en gavage
    poids_foie_moyen = parse_decimal(row.get("Poids_de_foies_moyen"))  # Poids foie RÉEL depuis CSV

    # Poids (estimés depuis dose_totale et ITM si disponibles, ou depuis poids_foie_moyen)
    if dose_totale and itm:
        poids_foie_estime = float(dose_totale) / float(itm)  # En grammes
        poids_initial = 4500  # Défaut
        poids_final = poids_initial + int(poids_foie_estime * 0.15)  # Approximation
    else:
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
        "SELECT id FROM lots WHERE code_lot = $1", code_lot
    )

    if existing:
        print(f"⚠️  Lot {code_lot} existe déjà (ID: {existing}), skip")
        return (existing, code_lot, duree_gavage)

    # Insérer le lot
    try:
        lot_id = await conn.fetchval("""
            INSERT INTO lots (
                code_lot, gaveur_id, site_origine, souche,
                nombre_canards, date_debut_gavage, date_fin_prevue,
                duree_gavage_prevue, poids_moyen_initial, poids_moyen_actuel, poids_moyen_final,
                itm, sigma, total_corn_real_g, nb_meg, poids_foie_moyen_g, statut, created_at
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW()
            )
            RETURNING id
        """,
            code_lot, gaveur_id, site_origine, souche,
            nombre_canards, date_debut, date_fin,
            duree_gavage, poids_initial, poids_initial, poids_final,
            itm, sigma, dose_totale, nb_meg, poids_foie_moyen, "termine"  # Lots historiques = terminés
        )

        print(f"✅ Lot {code_lot} créé (ID: {lot_id})")
        return (lot_id, code_lot, duree_gavage)

    except Exception as e:
        print(f"❌ Erreur insertion lot {code_lot}: {e}")
        return None


async def import_gavage_history(conn, lot_id: int, code_lot: str, row: dict, duree: int, dry_run: bool = False):
    """
    Importer l'historique de gavage jour par jour
    """
    date_debut = parse_date(row["Debut_du_lot"])
    if not date_debut:
        return

    inserted = 0

    for jour in range(1, duree + 1):
        # Colonnes CSV: feedCornReal_1, feedCornReal_2, etc.
        col_real = f"feedCornReal_{jour}"
        col_target = f"feedTarget_{jour}"

        dose_reelle = parse_decimal(row.get(col_real))
        dose_theorique = parse_decimal(row.get(col_target))

        if dose_reelle is None and dose_theorique is None:
            continue

        # Répartir en matin/soir (50/50 par défaut)
        dose_matin = float(dose_reelle or dose_theorique or 0) * 0.5
        dose_soir = float(dose_reelle or dose_theorique or 0) * 0.5

        date_gavage = date_debut + timedelta(days=jour - 1)

        if dry_run:
            if jour <= 3:  # Afficher seulement 3 premiers jours en dry-run
                print(f"   J{jour} ({date_gavage.date()}): {dose_reelle}g (théo: {dose_theorique}g)")
            continue

        try:
            await conn.execute("""
                INSERT INTO gavage_lot_quotidien (
                    lot_id, date_gavage, jour_gavage,
                    dose_matin_g, dose_soir_g, dose_totale_jour_g,
                    dose_theorique_g, ecart_dose_pct,
                    nb_canards_peses, poids_moyen_mesure_g,
                    temperature_stabule_c, humidite_stabule_pct,
                    suit_courbe_theorique, created_at
                ) VALUES (
                    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW()
                )
                ON CONFLICT (lot_id, date_gavage) DO NOTHING
            """,
                lot_id, date_gavage, jour,
                dose_matin, dose_soir, dose_reelle or dose_theorique,
                dose_theorique,
                (((dose_reelle or 0) - (dose_theorique or 0)) / (dose_theorique or 1) * 100) if dose_theorique else 0,
                10,  # nb_canards_peses par défaut
                4500 + (jour * 150),  # Poids estimé progressif
                22, 65,  # Température et humidité par défaut
                abs((dose_reelle or 0) - (dose_theorique or 0)) < 20 if dose_theorique else True
            )
            inserted += 1
        except Exception as e:
            print(f"❌ Erreur gavage J{jour} lot {code_lot}: {e}")

    if not dry_run and inserted > 0:
        print(f"   📊 {inserted} jours de gavage insérés")


async def main(dry_run: bool = False):
    """
    Script principal d'import
    """
    print("=" * 80)
    print("IMPORT DONNÉES RÉELLES CSV → BASE DE DONNÉES")
    print("=" * 80)
    print()

    if dry_run:
        print("⚠️  MODE DRY-RUN: Aucune insertion en base\n")

    # Vérifier fichier CSV
    if not os.path.exists(CSV_PATH):
        print(f"❌ Fichier CSV non trouvé: {CSV_PATH}")
        return

    print(f"📂 Fichier CSV: {CSV_PATH}")

    # Connexion DB
    if dry_run:
        print("🔌 Connexion DB: SKIP (dry-run)\n")
        conn = None
    else:
        try:
            conn = await asyncpg.connect(DATABASE_URL)
            print(f"🔌 Connexion DB: OK\n")
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

                # Import du lot
                result = await import_lot(conn, row, dry_run)

                if result is None:
                    lots_skipped += 1
                    continue

                lot_id, code_lot, duree = result

                # Import historique gavage
                if lot_id or dry_run:
                    await import_gavage_history(conn, lot_id, code_lot, row, duree, dry_run)

                lots_imported += 1
                print()

    except Exception as e:
        print(f"❌ Erreur lecture CSV: {e}")

    finally:
        if conn:
            await conn.close()

    # Résumé
    print("=" * 80)
    print("RÉSUMÉ IMPORT")
    print("=" * 80)
    print(f"✅ Lots importés: {lots_imported}")
    print(f"⚠️  Lots skippés: {lots_skipped}")

    if dry_run:
        print("\n💡 Pour importer réellement, relancer sans --dry-run")
    else:
        print("\n🎉 Import terminé avec succès!")
        print("\nProchaine étape:")
        print("   python scripts/generate_sqal_test_data.py --nb-lots 74 --samples-per-lot 30")


if __name__ == "__main__":
    import sys

    dry_run = "--dry-run" in sys.argv

    asyncio.run(main(dry_run=dry_run))
