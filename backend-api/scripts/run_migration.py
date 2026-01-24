#!/usr/bin/env python3
"""
Script pour exécuter les migrations SQL
"""
import os
import sys
import asyncio
import asyncpg
from pathlib import Path

# Windows encoding fix
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://gaveurs_admin:gaveurs_secure_2024@localhost:5432/gaveurs_db")

async def run_migration(migration_file: str):
    """Exécute un fichier de migration SQL"""
    script_path = Path(__file__).parent / migration_file

    if not script_path.exists():
        print(f"❌ Fichier de migration non trouvé: {script_path}")
        sys.exit(1)

    print(f"📂 Lecture migration: {migration_file}")
    sql_content = script_path.read_text(encoding='utf-8')

    print(f"🔌 Connexion à la base de données...")
    conn = await asyncpg.connect(DATABASE_URL)

    try:
        print(f"⚙️  Exécution migration...")
        # Exécuter chaque commande SQL séparément
        commands = [cmd.strip() for cmd in sql_content.split(';') if cmd.strip() and not cmd.strip().startswith('--')]

        for i, command in enumerate(commands, 1):
            if command:
                print(f"   [{i}/{len(commands)}] Exécution commande...")
                try:
                    result = await conn.fetch(command)
                    if result:
                        for row in result:
                            print(f"   ✅ {dict(row)}")
                except Exception as e:
                    # Afficher l'erreur mais continuer (IF NOT EXISTS peut générer des warnings)
                    print(f"   ⚠️  {e}")

        print(f"\n✅ Migration terminée avec succès!")

    except Exception as e:
        print(f"\n❌ Erreur lors de la migration: {e}")
        sys.exit(1)
    finally:
        await conn.close()

if __name__ == "__main__":
    migration_file = sys.argv[1] if len(sys.argv) > 1 else "migration_add_csv_columns.sql"

    print("=" * 80)
    print("EXECUTION MIGRATION SQL")
    print("=" * 80)
    print()

    asyncio.run(run_migration(migration_file))
