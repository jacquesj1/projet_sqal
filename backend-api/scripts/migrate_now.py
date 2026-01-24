"""
Migration rapide - Ajouter colonnes CSV
Utilise asyncpg comme le backend
"""
import asyncio
import asyncpg
import os
import sys

# Fix encoding Windows
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')

async def migrate():
    print("=" * 80)
    print("MIGRATION COLONNES CSV")
    print("=" * 80)
    print()

    # Connexion directe
    print("Connexion à PostgreSQL...")
    try:
        conn = await asyncpg.connect(
            host='localhost',
            port=5432,
            database='gaveurs_db',
            user='gaveurs_admin',
            password='gaveurs_secure_2024'
        )
        print("✅ Connecté\n")
    except Exception as e:
        print(f"❌ Erreur connexion: {e}")
        return

    try:
        # 1. Ajouter total_corn_real_g
        print("[1/6] Ajout colonne total_corn_real_g...")
        await conn.execute("""
            ALTER TABLE lots_gavage
            ADD COLUMN IF NOT EXISTS total_corn_real_g DECIMAL(10, 2)
        """)
        print("✅ OK\n")

        # 2. Ajouter nb_meg
        print("[2/6] Ajout colonne nb_meg...")
        await conn.execute("""
            ALTER TABLE lots_gavage
            ADD COLUMN IF NOT EXISTS nb_meg INTEGER DEFAULT 0
        """)
        print("✅ OK\n")

        # 3. Ajouter poids_foie_moyen_g
        print("[3/6] Ajout colonne poids_foie_moyen_g...")
        await conn.execute("""
            ALTER TABLE lots_gavage
            ADD COLUMN IF NOT EXISTS poids_foie_moyen_g DECIMAL(8, 2)
        """)
        print("✅ OK\n")

        # 4. Index total_corn
        print("[4/6] Création index total_corn...")
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_lots_gavage_total_corn
            ON lots_gavage(total_corn_real_g) WHERE total_corn_real_g IS NOT NULL
        """)
        print("✅ OK\n")

        # 5. Index nb_meg
        print("[5/6] Création index nb_meg...")
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_lots_gavage_nb_meg
            ON lots_gavage(nb_meg) WHERE nb_meg > 0
        """)
        print("✅ OK\n")

        # 6. Index poids_foie
        print("[6/6] Création index poids_foie...")
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_lots_gavage_poids_foie
            ON lots_gavage(poids_foie_moyen_g) WHERE poids_foie_moyen_g IS NOT NULL
        """)
        print("✅ OK\n")

        # Vérification
        print("Vérification des colonnes créées:")
        rows = await conn.fetch("""
            SELECT column_name, data_type, column_default
            FROM information_schema.columns
            WHERE table_name = 'lots_gavage'
            AND column_name IN ('total_corn_real_g', 'nb_meg', 'poids_foie_moyen_g')
            ORDER BY column_name
        """)

        for row in rows:
            print(f"  ✅ {row['column_name']}: {row['data_type']} (default: {row['column_default']})")

        print("\n" + "=" * 80)
        print("MIGRATION TERMINÉE AVEC SUCCÈS")
        print("=" * 80)

    except Exception as e:
        print(f"\n❌ Erreur migration: {e}")
    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(migrate())
