-- Migration: Ajouter le champ password_hash à la table gaveurs
-- ==============================================================
--
-- Date: 2026-01-14
-- Objet: Support JWT authentication avec mots de passe hashés
--
-- Cette migration ajoute un champ password_hash à la table gaveurs
-- pour stocker les mots de passe hashés avec bcrypt

-- Ajouter la colonne password_hash si elle n'existe pas
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'gaveurs'
        AND column_name = 'password_hash'
    ) THEN
        ALTER TABLE gaveurs
        ADD COLUMN password_hash VARCHAR(255);

        RAISE NOTICE 'Column password_hash added to gaveurs table';
    ELSE
        RAISE NOTICE 'Column password_hash already exists in gaveurs table';
    END IF;
END
$$;

-- Commenter la colonne
COMMENT ON COLUMN gaveurs.password_hash IS 'Hash bcrypt du mot de passe du gaveur (pour JWT auth)';

-- Index pour améliorer les performances de login
CREATE INDEX IF NOT EXISTS idx_gaveurs_email
ON gaveurs(email);

COMMENT ON INDEX idx_gaveurs_email IS 'Index pour accélérer les recherches par email lors du login';

-- Afficher le résultat
SELECT
    CASE
        WHEN password_hash IS NULL THEN 'Migration réussie - Les gaveurs existants devront se connecter avec "gaveur123" pour initialiser leur mot de passe'
        ELSE 'Mot de passe déjà configuré'
    END as status,
    COUNT(*) as nombre_gaveurs
FROM gaveurs
GROUP BY (password_hash IS NULL);
