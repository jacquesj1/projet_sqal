-- ================================================================================
-- SCHÉMA WORKFLOW PYSR 3-COURBES
-- ================================================================================
-- Description : Support complet du workflow PySR avec 3 types de courbes
--               1. Courbe Théorique (PySR + validation superviseur)
--               2. Courbe Réelle (saisie quotidienne gaveur)
--               3. Courbe de Correction Quotidienne (IA temps réel)
-- Date        : 9 Janvier 2026
-- Version     : 3.0.0
-- ================================================================================

-- 1️⃣ TABLE COURBES D'ALIMENTATION OPTIMALES (PySR + Validation)
-- ================================================================================
-- Stocke les courbes théoriques générées par PySR et validées par superviseur
CREATE TABLE IF NOT EXISTS courbes_gavage_optimales (
    id SERIAL PRIMARY KEY,
    lot_id INTEGER NOT NULL REFERENCES lots_gavage(id) ON DELETE CASCADE,
    gaveur_id INTEGER NOT NULL REFERENCES gaveurs_euralis(id),
    site_code VARCHAR(2) NOT NULL REFERENCES sites_euralis(code),

    -- Métadonnées PySR
    pysr_equation TEXT,  -- Équation symbolique générée (ex: "0.5 * jour^2 + 2.3 * jour + 10")
    pysr_r2_score DECIMAL(5, 4),  -- R² du modèle PySR
    pysr_complexity INTEGER,  -- Complexité de l'équation
    pysr_trained_at TIMESTAMPTZ,  -- Date d'entraînement PySR

    -- Courbe théorique (array de doses quotidiennes)
    courbe_theorique JSONB NOT NULL,  -- Ex: [{"jour": 1, "dose_g": 120}, {"jour": 2, "dose_g": 145}, ...]
    duree_gavage_jours INTEGER NOT NULL,  -- Durée totale de gavage (ex: 14 jours)

    -- Workflow validation superviseur
    statut VARCHAR(20) NOT NULL DEFAULT 'EN_ATTENTE',  -- EN_ATTENTE, VALIDEE, MODIFIEE, REJETEE
    superviseur_id INTEGER,  -- ID superviseur qui valide (NULL si pas encore validé)
    superviseur_nom VARCHAR(100),
    date_validation TIMESTAMPTZ,
    commentaire_superviseur TEXT,

    -- Modifications manuelles superviseur
    courbe_modifiee JSONB,  -- Courbe ajustée manuellement par superviseur (NULL si pas modifiée)
    raison_modification TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE courbes_gavage_optimales IS 'Courbes théoriques PySR validées par superviseur pour chaque lot';
COMMENT ON COLUMN courbes_gavage_optimales.pysr_equation IS 'Équation symbolique optimale découverte par PySR';
COMMENT ON COLUMN courbes_gavage_optimales.courbe_theorique IS 'Array JSON de doses quotidiennes théoriques (jour 1 à N)';
COMMENT ON COLUMN courbes_gavage_optimales.statut IS 'EN_ATTENTE: PySR généré | VALIDEE: superviseur OK | MODIFIEE: superviseur ajusté | REJETEE: refusée';

-- Index
CREATE INDEX IF NOT EXISTS idx_courbes_lot ON courbes_gavage_optimales(lot_id);
CREATE INDEX IF NOT EXISTS idx_courbes_gaveur ON courbes_gavage_optimales(gaveur_id);
CREATE INDEX IF NOT EXISTS idx_courbes_site ON courbes_gavage_optimales(site_code);
CREATE INDEX IF NOT EXISTS idx_courbes_statut ON courbes_gavage_optimales(statut);


-- 2️⃣ TABLE COURBE RÉELLE (Saisie quotidienne gaveur)
-- ================================================================================
-- Stocke les doses RÉELLEMENT données par le gaveur chaque jour
-- Hypertable pour gestion optimale des séries temporelles
CREATE TABLE IF NOT EXISTS courbe_reelle_quotidienne (
    id BIGSERIAL,
    lot_id INTEGER NOT NULL REFERENCES lots_gavage(id) ON DELETE CASCADE,
    gaveur_id INTEGER NOT NULL REFERENCES gaveurs_euralis(id),
    site_code VARCHAR(2) NOT NULL REFERENCES sites_euralis(code),

    -- Données quotidiennes
    date_gavage DATE NOT NULL,  -- Date du gavage
    jour_gavage INTEGER NOT NULL,  -- Jour de gavage (1, 2, 3, ... N)
    dose_reelle_g DECIMAL(6, 2) NOT NULL,  -- Dose réelle donnée par gaveur (grammes)

    -- Référence courbe théorique
    courbe_optimale_id INTEGER REFERENCES courbes_gavage_optimales(id),
    dose_theorique_g DECIMAL(6, 2),  -- Dose théorique prévue ce jour-là

    -- Écart / Alerte
    ecart_g DECIMAL(6, 2),  -- dose_reelle - dose_theorique
    ecart_pct DECIMAL(5, 2),  -- (ecart / dose_theorique) * 100
    alerte_ecart BOOLEAN DEFAULT FALSE,  -- TRUE si écart > seuil

    -- Métadonnées
    saisie_mode VARCHAR(20) DEFAULT 'MANUEL',  -- MANUEL, AUTO, IMPORT_CSV
    commentaire_gaveur TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Constraint unique: 1 seule saisie par lot/jour (MUST include partitioning column)
    CONSTRAINT unique_lot_jour UNIQUE (lot_id, jour_gavage, date_gavage)
);

-- Convertir en hypertable TimescaleDB (partitionnement par date_gavage)
SELECT create_hypertable(
    'courbe_reelle_quotidienne',
    'date_gavage',
    if_not_exists => TRUE,
    migrate_data => TRUE
);

COMMENT ON TABLE courbe_reelle_quotidienne IS 'Courbe réelle: doses quotidiennes saisies par gaveur (hypertable)';
COMMENT ON COLUMN courbe_reelle_quotidienne.ecart_g IS 'Écart en grammes: dose réelle - dose théorique';

-- Index
CREATE INDEX IF NOT EXISTS idx_courbe_reelle_lot ON courbe_reelle_quotidienne(lot_id, date_gavage DESC);
CREATE INDEX IF NOT EXISTS idx_courbe_reelle_gaveur ON courbe_reelle_quotidienne(gaveur_id, date_gavage DESC);
CREATE INDEX IF NOT EXISTS idx_courbe_reelle_alerte ON courbe_reelle_quotidienne(alerte_ecart, date_gavage DESC);


-- 3️⃣ TABLE CORRECTIONS IA QUOTIDIENNES
-- ================================================================================
-- Stocke les suggestions de correction de l'IA en temps réel
CREATE TABLE IF NOT EXISTS corrections_ia_quotidiennes (
    id BIGSERIAL,
    lot_id INTEGER NOT NULL REFERENCES lots_gavage(id) ON DELETE CASCADE,
    gaveur_id INTEGER NOT NULL REFERENCES gaveurs_euralis(id),

    -- Contexte correction
    date_correction DATE NOT NULL,
    jour_gavage INTEGER NOT NULL,

    -- Analyse écart
    ecart_detecte_g DECIMAL(6, 2) NOT NULL,
    ecart_detecte_pct DECIMAL(5, 2) NOT NULL,

    -- Suggestion IA
    dose_suggeree_g DECIMAL(6, 2) NOT NULL,  -- Nouvelle dose suggérée par IA
    raison_suggestion TEXT,  -- Explication IA (ex: "Écart cumulé trop important")
    confiance_score DECIMAL(3, 2),  -- 0.0 à 1.0

    -- Acceptation gaveur
    acceptee BOOLEAN DEFAULT NULL,  -- NULL: pas encore répondu, TRUE: acceptée, FALSE: refusée
    dose_finale_appliquee_g DECIMAL(6, 2),  -- Dose finalement appliquée
    date_reponse_gaveur TIMESTAMPTZ,

    -- Métadonnées
    modele_ia VARCHAR(50) DEFAULT 'feedback_optimizer',  -- Modèle utilisé

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT unique_correction_lot_jour UNIQUE (lot_id, jour_gavage, date_correction)
);

-- Convertir en hypertable
SELECT create_hypertable(
    'corrections_ia_quotidiennes',
    'date_correction',
    if_not_exists => TRUE,
    migrate_data => TRUE
);

COMMENT ON TABLE corrections_ia_quotidiennes IS 'Corrections suggérées par IA en temps réel basées sur écarts détectés';
COMMENT ON COLUMN corrections_ia_quotidiennes.acceptee IS 'NULL: en attente | TRUE: gaveur accepte | FALSE: gaveur refuse';

-- Index
CREATE INDEX IF NOT EXISTS idx_corrections_lot ON corrections_ia_quotidiennes(lot_id, date_correction DESC);
CREATE INDEX IF NOT EXISTS idx_corrections_gaveur ON corrections_ia_quotidiennes(gaveur_id, date_correction DESC);
CREATE INDEX IF NOT EXISTS idx_corrections_acceptation ON corrections_ia_quotidiennes(acceptee, date_correction DESC);


-- 4️⃣ TABLE HISTORIQUE ENTRAÎNEMENTS PYSR
-- ================================================================================
-- Trace tous les entraînements PySR (succès, échecs, durée, métriques)
CREATE TABLE IF NOT EXISTS pysr_training_history (
    id SERIAL PRIMARY KEY,
    lot_id INTEGER REFERENCES lots_gavage(id),
    gaveur_id INTEGER REFERENCES gaveurs_euralis(id),

    -- Configuration entraînement
    nb_iterations INTEGER,
    max_complexity INTEGER,
    binary_operators TEXT,  -- Ex: "+, -, *, /"
    unary_operators TEXT,  -- Ex: "sin, cos, exp, log"

    -- Résultats
    statut VARCHAR(20) NOT NULL,  -- SUCCESS, FAILED, TIMEOUT
    best_equation TEXT,
    r2_score DECIMAL(5, 4),
    mae DECIMAL(8, 4),  -- Mean Absolute Error
    complexity INTEGER,

    -- Performance
    duree_secondes INTEGER,
    nb_equations_generees INTEGER,

    -- Données source
    nb_lots_entrainement INTEGER,
    date_debut_donnees DATE,
    date_fin_donnees DATE,

    -- Erreur si échec
    error_message TEXT,

    -- Timestamps
    started_at TIMESTAMPTZ NOT NULL,
    finished_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE pysr_training_history IS 'Historique complet des entraînements PySR avec métriques';

-- Index
CREATE INDEX IF NOT EXISTS idx_pysr_history_lot ON pysr_training_history(lot_id);
CREATE INDEX IF NOT EXISTS idx_pysr_history_statut ON pysr_training_history(statut, started_at DESC);


-- 5️⃣ VUE MATÉRIALISÉE - DASHBOARD 3 COURBES
-- ================================================================================
-- Vue agrégée pour affichage rapide dashboard gaveur (courbe théo vs réelle vs correction)
CREATE MATERIALIZED VIEW IF NOT EXISTS dashboard_courbes_gaveur AS
SELECT
    lg.id as lot_id,
    lg.code_lot,
    lg.gaveur_id,
    ge.nom || COALESCE(' ' || ge.prenom, '') as gaveur_nom,
    lg.site_code,
    lg.statut as lot_statut,

    -- Courbe théorique
    co.id as courbe_optimale_id,
    co.pysr_equation,
    co.statut as courbe_statut,
    co.duree_gavage_jours,
    co.courbe_theorique,
    co.courbe_modifiee,

    -- Stats courbe réelle
    COUNT(DISTINCT crq.id) as nb_jours_saisis,
    AVG(crq.ecart_pct) as ecart_moyen_pct,
    MAX(crq.ecart_pct) as ecart_max_pct,
    SUM(CASE WHEN crq.alerte_ecart THEN 1 ELSE 0 END) as nb_alertes_ecart,

    -- Stats corrections IA
    COUNT(DISTINCT cia.id) as nb_corrections_suggerees,
    SUM(CASE WHEN cia.acceptee = TRUE THEN 1 ELSE 0 END) as nb_corrections_acceptees,
    AVG(cia.confiance_score) as confiance_moyenne_ia,

    -- Dernière activité
    MAX(crq.date_gavage) as derniere_saisie_date,
    MAX(cia.date_correction) as derniere_correction_date

FROM lots_gavage lg
JOIN gaveurs_euralis ge ON lg.gaveur_id = ge.id
LEFT JOIN courbes_gavage_optimales co ON lg.id = co.lot_id
LEFT JOIN courbe_reelle_quotidienne crq ON lg.id = crq.lot_id
LEFT JOIN corrections_ia_quotidiennes cia ON lg.id = cia.lot_id
WHERE lg.statut IN ('EN_COURS', 'TERMINE')
GROUP BY
    lg.id, lg.code_lot, lg.gaveur_id, ge.nom, ge.prenom,
    lg.site_code, lg.statut,
    co.id, co.pysr_equation, co.statut, co.duree_gavage_jours,
    co.courbe_theorique, co.courbe_modifiee;

COMMENT ON MATERIALIZED VIEW dashboard_courbes_gaveur IS 'Vue agrégée dashboard 3 courbes pour gaveurs et superviseurs';

-- Index sur la vue matérialisée
CREATE INDEX IF NOT EXISTS idx_dashboard_courbes_gaveur ON dashboard_courbes_gaveur(gaveur_id, lot_id);
CREATE INDEX IF NOT EXISTS idx_dashboard_courbes_lot ON dashboard_courbes_gaveur(lot_id);

-- Refresh automatique (peut être appelé par cron ou trigger)
-- REFRESH MATERIALIZED VIEW CONCURRENTLY dashboard_courbes_gaveur;


-- 6️⃣ FONCTION TRIGGER - Auto-calcul écarts
-- ================================================================================
-- Calcule automatiquement écart_g et écart_pct à l'insertion courbe_reelle_quotidienne
CREATE OR REPLACE FUNCTION calcul_ecart_courbe_reelle()
RETURNS TRIGGER AS $$
DECLARE
    dose_theo DECIMAL(6,2);
BEGIN
    -- Récupérer dose théorique du jour depuis courbe optimale
    IF NEW.courbe_optimale_id IS NOT NULL THEN
        SELECT (elem->>'dose_g')::DECIMAL(6,2) INTO dose_theo
        FROM courbes_gavage_optimales cgo,
             jsonb_array_elements(
                 COALESCE(cgo.courbe_modifiee, cgo.courbe_theorique)
             ) elem
        WHERE cgo.id = NEW.courbe_optimale_id
          AND (elem->>'jour')::INTEGER = NEW.jour_gavage;

        NEW.dose_theorique_g := dose_theo;

        -- Calculer écarts
        IF dose_theo IS NOT NULL THEN
            NEW.ecart_g := NEW.dose_reelle_g - dose_theo;
            NEW.ecart_pct := ((NEW.dose_reelle_g - dose_theo) / dose_theo) * 100;

            -- Déclencher alerte si écart > 10%
            NEW.alerte_ecart := (ABS(NEW.ecart_pct) > 10);
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attacher trigger
DROP TRIGGER IF EXISTS trigger_calcul_ecart ON courbe_reelle_quotidienne;
CREATE TRIGGER trigger_calcul_ecart
    BEFORE INSERT OR UPDATE ON courbe_reelle_quotidienne
    FOR EACH ROW
    EXECUTE FUNCTION calcul_ecart_courbe_reelle();

COMMENT ON FUNCTION calcul_ecart_courbe_reelle IS 'Auto-calcule écart dose réelle vs théorique et déclenche alerte si > 10%';


-- 7️⃣ FONCTION - Génération correction IA
-- ================================================================================
-- Fonction appelée par backend pour suggérer correction basée sur écart
CREATE OR REPLACE FUNCTION generer_correction_ia(
    p_lot_id INTEGER,
    p_jour_gavage INTEGER,
    p_ecart_g DECIMAL,
    p_ecart_pct DECIMAL
)
RETURNS TABLE(
    dose_suggeree DECIMAL(6,2),
    raison TEXT,
    confiance DECIMAL(3,2)
) AS $$
DECLARE
    v_dose_theorique DECIMAL(6,2);
    v_dose_suggeree DECIMAL(6,2);
    v_raison TEXT;
    v_confiance DECIMAL(3,2);
BEGIN
    -- Logique simple de correction (à améliorer avec ML réel)
    -- Récupérer dose théorique jour suivant
    SELECT (elem->>'dose_g')::DECIMAL(6,2) INTO v_dose_theorique
    FROM courbes_gavage_optimales cgo,
         jsonb_array_elements(
             COALESCE(cgo.courbe_modifiee, cgo.courbe_theorique)
         ) elem
    WHERE cgo.lot_id = p_lot_id
      AND (elem->>'jour')::INTEGER = p_jour_gavage + 1
    LIMIT 1;

    -- Si écart positif (trop donné), réduire dose suivante
    IF p_ecart_g > 0 THEN
        v_dose_suggeree := v_dose_theorique - (ABS(p_ecart_g) * 0.5);
        v_raison := FORMAT('Écart positif de %.1fg détecté. Réduire dose suivante pour compenser.', p_ecart_g);
        v_confiance := 0.75;
    -- Si écart négatif (pas assez donné), augmenter dose suivante
    ELSIF p_ecart_g < 0 THEN
        v_dose_suggeree := v_dose_theorique + (ABS(p_ecart_g) * 0.5);
        v_raison := FORMAT('Écart négatif de %.1fg détecté. Augmenter dose suivante pour rattraper.', ABS(p_ecart_g));
        v_confiance := 0.75;
    ELSE
        v_dose_suggeree := v_dose_theorique;
        v_raison := 'Aucun écart significatif. Maintenir dose théorique.';
        v_confiance := 0.95;
    END IF;

    RETURN QUERY SELECT v_dose_suggeree, v_raison, v_confiance;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION generer_correction_ia IS 'Génère suggestion de correction IA basée sur écart détecté (logique simple, à améliorer)';


-- ================================================================================
-- FIN DU SCHÉMA
-- ================================================================================

-- Affichage résumé tables créées
SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as taille
FROM pg_tables
WHERE tablename IN (
    'courbes_gavage_optimales',
    'courbe_reelle_quotidienne',
    'corrections_ia_quotidiennes',
    'pysr_training_history',
    'dashboard_courbes_gaveur'
)
ORDER BY tablename;
