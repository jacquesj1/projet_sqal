-- =============================================================================
-- VIEW: lots
-- =============================================================================
-- Vue qui expose lots_gavage avec les noms de colonnes attendus par le frontend
-- Cette vue permet de maintenir la compatibilité sans dupliquer les données
--
-- Mapping:
--   lots_gavage.site_code           → lots.site_origine
--   lots_gavage.nb_canards_initial  → lots.nombre_canards
--   lots_gavage.debut_lot           → lots.date_debut_gavage
--   lots_gavage.jour_actuel         → lots.nombre_jours_gavage_ecoules
--   + Calculs automatiques pour les champs manquants
-- =============================================================================

DROP VIEW IF EXISTS lots CASCADE;

CREATE OR REPLACE VIEW lots AS
SELECT
    -- Colonnes de base (identiques)
    id,
    code_lot,
    gaveur_id,
    statut,
    genetique,
    created_at,
    updated_at,

    -- Mapping des noms de colonnes
    site_code AS site_origine,
    nb_canards_initial AS nombre_canards,
    debut_lot AS date_debut_gavage,

    -- Date de fin prévue (calculée si manquante)
    CASE
        WHEN debut_lot IS NOT NULL THEN
            debut_lot + INTERVAL '1 day' * COALESCE(duree_gavage_reelle, 14)
        ELSE NULL
    END AS date_fin_gavage_prevue,

    -- Date de fin réelle (null pour lots en cours)
    CASE
        WHEN statut IN ('termine', 'abattu') THEN
            debut_lot + INTERVAL '1 day' * COALESCE(duree_gavage_reelle, 14)
        ELSE NULL
    END AS date_fin_gavage_reelle,

    -- Poids
    COALESCE(poids_moyen_actuel, 4000.0) AS poids_moyen_initial,  -- 4kg par défaut
    poids_moyen_actuel,
    CASE
        WHEN statut = 'abattu' THEN poids_moyen_actuel
        ELSE NULL
    END AS poids_moyen_final,

    -- Objectifs (valeurs par défaut si manquantes)
    COALESCE(total_corn_target, 0) AS objectif_quantite_mais,
    7000 AS objectif_poids_final,  -- 7kg par défaut

    -- Progression
    COALESCE(jour_actuel, 0) AS nombre_jours_gavage_ecoules,

    -- Mortalité
    COALESCE(taux_mortalite, 0.0) AS taux_mortalite,
    COALESCE(nb_morts,
        CAST(nb_canards_initial * COALESCE(taux_mortalite, 0.0) / 100 AS INTEGER)
    ) AS nombre_mortalite,

    -- Autres champs utiles de lots_gavage
    itm,
    sigma,
    pctg_perte_gavage,
    duree_gavage_reelle,
    nb_accroches,
    nb_morts,
    pret_abattage,

    -- Champs calculés/manquants (retourner NULL pour compatibilité frontend)
    NULL::FLOAT AS taux_conformite,
    NULL::JSONB AS courbe_theorique,
    NULL::TEXT AS formule_pysr,
    NULL::FLOAT AS r2_score_theorique

FROM lots_gavage;

-- =============================================================================
-- Commentaires sur la vue
-- =============================================================================

COMMENT ON VIEW lots IS
'Vue de compatibilité qui expose lots_gavage avec les noms de colonnes attendus par les frontends.
Permet de maintenir la compatibilité sans dupliquer les données.';

-- =============================================================================
-- Permissions
-- =============================================================================

GRANT SELECT ON lots TO gaveurs_admin;
GRANT SELECT ON lots TO gaveurs_app;
