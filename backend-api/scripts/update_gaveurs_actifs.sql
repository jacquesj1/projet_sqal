-- ================================================================================
-- Migration: Synchronisation nb_gaveurs_actifs avec les données réelles
-- Date: 2024-01-01
-- Description: Met à jour automatiquement le nombre de gaveurs actifs par site
-- ================================================================================

-- Créer une vue pour les gaveurs actifs réels par site
CREATE OR REPLACE VIEW v_gaveurs_actifs_par_site AS
SELECT
    s.code,
    s.nom,
    s.region,
    s.capacite_gavage_max,
    COUNT(DISTINCT l.gaveur_id) as nb_gaveurs_actifs_reel,
    COUNT(DISTINCT CASE WHEN l.statut = 'en_cours' THEN l.id END) as nb_lots_actifs,
    COUNT(DISTINCT CASE WHEN l.statut IN ('termine', 'abattu') THEN l.id END) as nb_lots_termines
FROM sites_euralis s
LEFT JOIN lots_gavage l ON s.code = l.site_code
GROUP BY s.code, s.nom, s.region, s.capacite_gavage_max
ORDER BY s.code;

-- Mettre à jour la colonne nb_gaveurs_actifs avec les valeurs réelles
UPDATE sites_euralis s
SET nb_gaveurs_actifs = COALESCE((
    SELECT COUNT(DISTINCT gaveur_id)
    FROM lots_gavage
    WHERE site_code = s.code
), 0);

-- Créer une fonction pour rafraîchir automatiquement
CREATE OR REPLACE FUNCTION refresh_nb_gaveurs_actifs()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE sites_euralis s
    SET nb_gaveurs_actifs = COALESCE((
        SELECT COUNT(DISTINCT gaveur_id)
        FROM lots_gavage
        WHERE site_code = s.code
    ), 0)
    WHERE s.code = COALESCE(NEW.site_code, OLD.site_code);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Créer un trigger pour mettre à jour automatiquement lors d'INSERT/UPDATE/DELETE
DROP TRIGGER IF EXISTS trigger_refresh_nb_gaveurs_actifs ON lots_gavage;

CREATE TRIGGER trigger_refresh_nb_gaveurs_actifs
AFTER INSERT OR UPDATE OR DELETE ON lots_gavage
FOR EACH ROW
EXECUTE FUNCTION refresh_nb_gaveurs_actifs();

-- Vérification des résultats
SELECT
    code,
    nom,
    nb_gaveurs_actifs as gaveurs_actifs_bdd,
    (SELECT COUNT(DISTINCT gaveur_id) FROM lots_gavage WHERE site_code = s.code) as gaveurs_actifs_reel
FROM sites_euralis s
ORDER BY code;

-- Afficher les statistiques finales
SELECT
    'LL' as site,
    nb_gaveurs_actifs as total,
    (SELECT COUNT(DISTINCT gaveur_id) FROM lots_gavage WHERE site_code = 'LL' AND statut = 'en_cours') as en_cours
FROM sites_euralis WHERE code = 'LL'
UNION ALL
SELECT
    'LS',
    nb_gaveurs_actifs,
    (SELECT COUNT(DISTINCT gaveur_id) FROM lots_gavage WHERE site_code = 'LS' AND statut = 'en_cours')
FROM sites_euralis WHERE code = 'LS'
UNION ALL
SELECT
    'MT',
    nb_gaveurs_actifs,
    (SELECT COUNT(DISTINCT gaveur_id) FROM lots_gavage WHERE site_code = 'MT' AND statut = 'en_cours')
FROM sites_euralis WHERE code = 'MT';

COMMENT ON VIEW v_gaveurs_actifs_par_site IS 'Vue matérialisée des gaveurs actifs réels par site';
COMMENT ON FUNCTION refresh_nb_gaveurs_actifs() IS 'Fonction trigger pour mettre à jour nb_gaveurs_actifs automatiquement';
