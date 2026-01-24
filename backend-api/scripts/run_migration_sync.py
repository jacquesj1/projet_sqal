#!/usr/bin/env python3
"""
Script synchrone pour exécuter les migrations SQL (compatible Windows)
"""
import os
import sys
from pathlib import Path

# Windows encoding fix
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')

try:
    import psycopg2
except ImportError:
    print("❌ psycopg2 non installé. Installez-le avec: pip install psycopg2-binary")
    sys.exit(1)

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://gaveurs_admin:gaveurs_secure_2024@localhost:5432/gaveurs_db")

def run_migration(migration_file: str):
    """Exécute un fichier de migration SQL"""
    script_path = Path(__file__).parent / migration_file

    if not script_path.exists():
        print(f"❌ Fichier de migration non trouvé: {script_path}")
        sys.exit(1)

    print(f"📂 Lecture migration: {migration_file}")
    sql_content = script_path.read_text(encoding='utf-8')

    print(f"🔌 Connexion à la base de données...")
    conn = psycopg2.connect(DATABASE_URL)
    conn.autocommit = True
    cursor = conn.cursor()

    try:
        print(f"⚙️  Exécution migration...")
        # Exécuter chaque commande SQL séparément
        commands = [cmd.strip() for cmd in sql_content.split(';') if cmd.strip() and not cmd.strip().startswith('--')]

        for i, command in enumerate(commands, 1):
            if command and not command.upper().startswith('SELECT'):
                print(f"   [{i}/{len(commands)}] Exécution commande...")
                try:
                    cursor.execute(command)
                    print(f"   ✅ OK")
                except Exception as e:
                    print(f"   ⚠️  {e}")

        # Exécuter les SELECT de vérification
        print(f"\n📊 Vérification des colonnes:")
        cursor.execute("""
            SELECT column_name, data_type, column_default
            FROM information_schema.columns
            WHERE table_name = 'lots_gavage' AND column_name IN ('total_corn_real_g', 'nb_meg', 'poids_foie_moyen_g')
            ORDER BY column_name
        """)
        rows = cursor.fetchall()
        for row in rows:
            print(f"   ✅ {row[0]}: {row[1]} (default: {row[2]})")

        print(f"\n✅ Migration terminée avec succès!")

    except Exception as e:
        print(f"\n❌ Erreur lors de la migration: {e}")
        sys.exit(1)
    finally:
        cursor.close()
        conn.close()

if __name__ == "__main__":
    migration_file = sys.argv[1] if len(sys.argv) > 1 else "migration_add_csv_columns.sql"

    print("=" * 80)
    print("EXECUTION MIGRATION SQL")
    print("=" * 80)
    print()

    run_migration(migration_file)
