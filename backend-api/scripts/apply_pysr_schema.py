"""
Script pour appliquer le schéma PySR 3-courbes
"""
import asyncio
import asyncpg
import os
import sys

DATABASE_URL = os.getenv(
    'DATABASE_URL',
    'postgresql://gaveurs_admin:gaveurs_secure_2024@localhost:5432/gaveurs_db'
)

async def apply_schema():
    """Applique le schéma PySR courbes"""
    print("[*] Connexion a la base de donnees...")

    conn = await asyncpg.connect(DATABASE_URL, ssl=False)

    try:
        # Lire le fichier SQL
        schema_path = os.path.join(os.path.dirname(__file__), 'pysr_courbes_schema.sql')

        with open(schema_path, 'r', encoding='utf-8') as f:
            sql = f.read()

        print(f"[*] Fichier SQL charge: {len(sql)} caracteres")

        # Diviser en statements individuels
        # Utiliser $$ comme séparateur pour les fonctions
        statements = []
        current_stmt = []
        in_dollar_quote = False

        for line in sql.split('\n'):
            line_stripped = line.strip()

            # Gérer les dollar quotes ($$)
            if '$$' in line:
                in_dollar_quote = not in_dollar_quote

            current_stmt.append(line)

            # Si on trouve un ; en dehors des dollar quotes
            if not in_dollar_quote and line_stripped.endswith(';'):
                stmt = '\n'.join(current_stmt)
                if stmt.strip() and not stmt.strip().startswith('--'):
                    statements.append(stmt)
                current_stmt = []

        if current_stmt:
            stmt = '\n'.join(current_stmt)
            if stmt.strip():
                statements.append(stmt)

        print(f"[*] {len(statements)} statements SQL a executer\n")

        # Exécuter chaque statement
        for i, stmt in enumerate(statements, 1):
            stmt_preview = stmt.strip()[:80].replace('\n', ' ')
            try:
                await conn.execute(stmt)
                print(f"  [OK] [{i}/{len(statements)}] {stmt_preview}...")
            except Exception as e:
                error_msg = str(e)
                if 'already exists' in error_msg or 'does not exist' in error_msg:
                    print(f"  [SKIP] [{i}/{len(statements)}] {stmt_preview}... (ignore: {error_msg[:50]})")
                else:
                    print(f"  [ERR] [{i}/{len(statements)}] ERREUR: {error_msg}")
                    raise

        print("\n[SUCCESS] Schema applique avec succes!\n")

        # Vérifier tables créées
        tables = await conn.fetch("""
            SELECT
                tablename,
                pg_size_pretty(pg_total_relation_size('public.'||tablename)) as taille
            FROM pg_tables
            WHERE tablename IN (
                'courbes_gavage_optimales',
                'courbe_reelle_quotidienne',
                'corrections_ia_quotidiennes',
                'pysr_training_history'
            )
            ORDER BY tablename
        """)

        if tables:
            print("[*] Tables creees:")
            for row in tables:
                print(f"  - {row['tablename']}: {row['taille']}")
        else:
            print("[WARN] Aucune table trouvee (peut-etre deja existantes)")

        # Verifier la vue materialisee
        views = await conn.fetch("""
            SELECT
                matviewname,
                pg_size_pretty(pg_total_relation_size('public.'||matviewname)) as taille
            FROM pg_matviews
            WHERE matviewname = 'dashboard_courbes_gaveur'
        """)

        if views:
            print("\n[*] Vue materialisee:")
            for row in views:
                print(f"  - {row['matviewname']}: {row['taille']}")

    except Exception as e:
        print(f"\n[ERROR] Erreur: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        await conn.close()
        print("\n[*] Connexion fermee")

if __name__ == '__main__':
    asyncio.run(apply_schema())
