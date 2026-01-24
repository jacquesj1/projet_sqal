"""
Script simple pour ajouter les colonnes CSV à lots_gavage
"""
import os

# Database connection string
DB_HOST = "localhost"
DB_PORT = "5432"
DB_NAME = "gaveurs_db"
DB_USER = "gaveurs_admin"
DB_PASS = "gaveurs_secure_2024"

# SQL commands
sql_commands = [
    "ALTER TABLE lots_gavage ADD COLUMN IF NOT EXISTS total_corn_real_g DECIMAL(10, 2);",
    "ALTER TABLE lots_gavage ADD COLUMN IF NOT EXISTS nb_meg INTEGER DEFAULT 0;",
    "ALTER TABLE lots_gavage ADD COLUMN IF NOT EXISTS poids_foie_moyen_g DECIMAL(8, 2);",
    "CREATE INDEX IF NOT EXISTS idx_lots_gavage_total_corn ON lots_gavage(total_corn_real_g) WHERE total_corn_real_g IS NOT NULL;",
    "CREATE INDEX IF NOT EXISTS idx_lots_gavage_nb_meg ON lots_gavage(nb_meg) WHERE nb_meg > 0;",
    "CREATE INDEX IF NOT EXISTS idx_lots_gavage_poids_foie ON lots_gavage(poids_foie_moyen_g) WHERE poids_foie_moyen_g IS NOT NULL;",
]

print("=" * 80)
print("MIGRATION CSV COLUMNS")
print("=" * 80)
print()

try:
    import psycopg2
    print(f"Connexion a {DB_HOST}:{DB_PORT}/{DB_NAME}...")
    conn = psycopg2.connect(
        host=DB_HOST,
        port=DB_PORT,
        dbname=DB_NAME,
        user=DB_USER,
        password=DB_PASS
    )
    conn.autocommit = True
    cursor = conn.cursor()

    print("OK\n")

    for i, sql in enumerate(sql_commands, 1):
        print(f"[{i}/{len(sql_commands)}] {sql[:60]}...")
        try:
            cursor.execute(sql)
            print("    OK")
        except Exception as e:
            print(f"    Erreur: {e}")

    print("\nVerification des colonnes:")
    cursor.execute("""
        SELECT column_name, data_type, column_default
        FROM information_schema.columns
        WHERE table_name = 'lots_gavage'
        AND column_name IN ('total_corn_real_g', 'nb_meg', 'poids_foie_moyen_g')
        ORDER BY column_name
    """)

    rows = cursor.fetchall()
    for row in rows:
        print(f"  - {row[0]}: {row[1]} (default: {row[2]})")

    cursor.close()
    conn.close()

    print("\nMigration terminee avec succes!")

except ImportError:
    print("ERREUR: psycopg2 non installe")
    print("Installez-le avec: pip install psycopg2-binary")
except Exception as e:
    print(f"ERREUR: {e}")
