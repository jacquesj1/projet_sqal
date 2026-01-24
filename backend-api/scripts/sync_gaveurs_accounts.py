#!/usr/bin/env python3
"""
Synchronisation gaveurs_euralis → gaveurs
Crée des comptes utilisateurs pour tous les gaveurs avec lots CSV
"""

import asyncio
import asyncpg
import hashlib
from datetime import datetime

DATABASE_URL = "postgresql://gaveurs_admin:gaveurs_secure_2024@gaveurs_timescaledb:5432/gaveurs_db"

# Mot de passe par défaut (sera hashé)
DEFAULT_PASSWORD = "gaveur2024"


def hash_password(password: str) -> str:
    """Hash simple pour démo (utiliser bcrypt en production)"""
    return hashlib.sha256(password.encode()).hexdigest()


async def main():
    print("=" * 80)
    print("SYNCHRONISATION COMPTES GAVEURS")
    print("=" * 80)
    print()

    conn = await asyncpg.connect(DATABASE_URL)

    try:
        # Récupérer tous les gaveurs avec lots CSV
        gaveurs_avec_lots = await conn.fetch("""
            SELECT DISTINCT ge.id, ge.nom, ge.prenom, ge.email, ge.telephone
            FROM gaveurs_euralis ge
            INNER JOIN lots_gavage l ON l.gaveur_id = ge.id
            WHERE l.code_lot LIKE 'LL%' OR l.code_lot LIKE 'LS%'
            ORDER BY ge.nom
        """)

        print(f"📋 {len(gaveurs_avec_lots)} gaveurs avec lots CSV trouvés\n")

        created = 0
        skipped = 0

        for ge in gaveurs_avec_lots:
            # Extraire nom et prénom depuis le champ nom
            nom_complet = ge['nom']

            # Si le nom contient un espace, séparer nom/prénom
            if ' ' in nom_complet:
                parts = nom_complet.split(' ', 1)
                nom = parts[0]
                prenom = parts[1] if len(parts) > 1 else 'Gaveur'
            else:
                nom = nom_complet
                prenom = ge['prenom'] or 'Gaveur'

            # Générer email si manquant
            email = ge['email']
            if not email or email.strip() == '':
                # Créer email basé sur nom
                nom_clean = nom.lower().replace(' ', '').replace('-', '')
                email = f"{nom_clean}@euralis.fr"

            # Générer téléphone si manquant
            telephone = ge['telephone'] or f"0{ge['id']:09d}"

            # Vérifier si compte existe déjà
            existing = await conn.fetchval(
                "SELECT id FROM gaveurs WHERE email = $1", email
            )

            if existing:
                skipped += 1
                print(f"⏭️  {nom_complet}: compte existe déjà ({email})")
                continue

            # Créer le compte
            try:
                password_hash = hash_password(DEFAULT_PASSWORD)

                await conn.execute("""
                    INSERT INTO gaveurs (
                        nom, prenom, email, telephone, password_hash,
                        actif, created_at
                    ) VALUES (
                        $1, $2, $3, $4, $5, true, NOW()
                    )
                """,
                    nom, prenom, email, telephone, password_hash
                )

                created += 1
                print(f"✅ {nom_complet}")
                print(f"   Email: {email}")
                print(f"   Mot de passe: {DEFAULT_PASSWORD}")
                print()

            except Exception as e:
                print(f"❌ Erreur pour {nom_complet}: {e}")
                print()

        print("=" * 80)
        print("RÉSUMÉ")
        print("=" * 80)
        print(f"✅ Comptes créés: {created}")
        print(f"⏭️  Déjà existants: {skipped}")
        print()
        print("📝 Informations de connexion par défaut:")
        print(f"   Mot de passe: {DEFAULT_PASSWORD}")
        print()
        print("⚠️  IMPORTANT: Demander aux gaveurs de changer leur mot de passe!")
        print()

        # Afficher quelques exemples
        print("Exemples de connexion:")
        examples = await conn.fetch("""
            SELECT g.nom, g.prenom, g.email, COUNT(l.id) as nb_lots
            FROM gaveurs g
            INNER JOIN gaveurs_euralis ge ON ge.email = g.email
            INNER JOIN lots_gavage l ON l.gaveur_id = ge.id
            WHERE l.code_lot LIKE 'LL%' OR l.code_lot LIKE 'LS%'
            GROUP BY g.id, g.nom, g.prenom, g.email
            ORDER BY nb_lots DESC
            LIMIT 5
        """)

        for ex in examples:
            print(f"  - {ex['nom']} {ex['prenom']}: {ex['email']} ({ex['nb_lots']} lots)")

    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
