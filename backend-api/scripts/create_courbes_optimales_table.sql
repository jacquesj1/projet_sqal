-- Table pour stocker les courbes de gavage optimales par gaveur
-- Sprint 3 - IA Courbes Optimales

CREATE TABLE IF NOT EXISTS courbes_optimales_gaveurs (
    id SERIAL PRIMARY KEY,
    gaveur_id INTEGER NOT NULL REFERENCES gaveurs_euralis(id) ON DELETE CASCADE,
    cluster_performance INTEGER NOT NULL,  -- Cluster ML du gaveur (0-4)
    souche VARCHAR(50),  -- Souche de canards (ex: Mulard)
    duree_jours INTEGER NOT NULL DEFAULT 11,  -- Durée de gavage en jours
    itm_cible DECIMAL(10,2),  -- ITM cible pour cette courbe
    courbe_json JSONB NOT NULL,  -- Courbe journalière en JSON
    score_performance DECIMAL(5,4),  -- Score de performance du gaveur
    source_generation VARCHAR(50) DEFAULT 'ML',  -- 'ML', 'historique', 'expert'
    nb_lots_base INTEGER,  -- Nombre de lots utilisés pour générer la courbe
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Index pour recherche rapide
CREATE INDEX IF NOT EXISTS idx_courbes_gaveur_id ON courbes_optimales_gaveurs(gaveur_id);
CREATE INDEX IF NOT EXISTS idx_courbes_cluster ON courbes_optimales_gaveurs(cluster_performance);
CREATE INDEX IF NOT EXISTS idx_courbes_souche ON courbes_optimales_gaveurs(souche);

-- Commentaires
COMMENT ON TABLE courbes_optimales_gaveurs IS 'Courbes de gavage optimales personnalisées par gaveur et profil';
COMMENT ON COLUMN courbes_optimales_gaveurs.courbe_json IS 'Structure: {"jours": [{"jour": 1, "matin": 300, "soir": 350, "total": 650}, ...]}';
COMMENT ON COLUMN courbes_optimales_gaveurs.cluster_performance IS 'Cluster ML du gaveur (0=Excellent, 4=Critique)';
COMMENT ON COLUMN courbes_optimales_gaveurs.score_performance IS 'Score normalisé 0-2 (20/ITM)';
COMMENT ON COLUMN courbes_optimales_gaveurs.source_generation IS 'Source: ML (généré par algo), historique (meilleur lot), expert (saisie manuelle)';

-- Table pour l'historique des recommandations
CREATE TABLE IF NOT EXISTS courbes_recommandations_historique (
    id SERIAL PRIMARY KEY,
    gaveur_id INTEGER NOT NULL REFERENCES gaveurs_euralis(id),
    courbe_id INTEGER REFERENCES courbes_optimales_gaveurs(id),
    lot_id INTEGER REFERENCES lots_gavage(id),
    date_recommandation TIMESTAMP DEFAULT NOW(),
    itm_cible DECIMAL(10,2),
    itm_reel DECIMAL(10,2),  -- Rempli après le lot
    ecart_itm DECIMAL(10,2),  -- Calculé: itm_reel - itm_cible
    recommandation_suivie BOOLEAN,  -- Le gaveur a-t-il suivi la courbe?
    taux_adherence DECIMAL(5,2),  -- % d'adhérence à la courbe (0-100)
    notes TEXT  -- Commentaires du gaveur
);

CREATE INDEX IF NOT EXISTS idx_reco_hist_gaveur ON courbes_recommandations_historique(gaveur_id);
CREATE INDEX IF NOT EXISTS idx_reco_hist_date ON courbes_recommandations_historique(date_recommandation DESC);

COMMENT ON TABLE courbes_recommandations_historique IS 'Historique des recommandations de courbes et leur efficacité réelle';
COMMENT ON COLUMN courbes_recommandations_historique.taux_adherence IS '% respect de la courbe recommandée (100% = suivi parfait)';

-- Trigger pour mettre à jour updated_at
CREATE OR REPLACE FUNCTION update_courbes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_courbes_timestamp
BEFORE UPDATE ON courbes_optimales_gaveurs
FOR EACH ROW
EXECUTE FUNCTION update_courbes_updated_at();

-- Vue pour analyses
CREATE OR REPLACE VIEW v_courbes_efficacite AS
SELECT
    g.id as gaveur_id,
    g.nom as gaveur_nom,
    c.cluster_performance,
    c.souche,
    c.itm_cible,
    COUNT(DISTINCT h.id) as nb_recommandations,
    COUNT(DISTINCT CASE WHEN h.recommandation_suivie THEN h.id END) as nb_suivies,
    ROUND(
        COUNT(DISTINCT CASE WHEN h.recommandation_suivie THEN h.id END)::numeric /
        NULLIF(COUNT(DISTINCT h.id), 0) * 100,
        2
    ) as taux_suivi_pct,
    AVG(h.taux_adherence) as adherence_moyenne,
    AVG(h.ecart_itm) as ecart_itm_moyen,
    c.score_performance
FROM gaveurs_euralis g
LEFT JOIN courbes_optimales_gaveurs c ON g.id = c.gaveur_id
LEFT JOIN courbes_recommandations_historique h ON c.id = h.courbe_id
GROUP BY g.id, g.nom, c.cluster_performance, c.souche, c.itm_cible, c.score_performance;

COMMENT ON VIEW v_courbes_efficacite IS 'Vue analyse efficacité des recommandations de courbes par gaveur';

-- Insertion d'exemples de courbes standard par cluster
-- Cluster 0: Excellent (ITM ~13, courbe aggressive)
INSERT INTO courbes_optimales_gaveurs (gaveur_id, cluster_performance, souche, duree_jours, itm_cible, courbe_json, source_generation, nb_lots_base)
SELECT
    id,
    0,
    'Mulard',
    11,
    13.0,
    '{"jours": [
        {"jour": 1, "matin": 250, "soir": 300, "total": 550},
        {"jour": 2, "matin": 300, "soir": 350, "total": 650},
        {"jour": 3, "matin": 350, "soir": 400, "total": 750},
        {"jour": 4, "matin": 400, "soir": 450, "total": 850},
        {"jour": 5, "matin": 450, "soir": 500, "total": 950},
        {"jour": 6, "matin": 480, "soir": 520, "total": 1000},
        {"jour": 7, "matin": 500, "soir": 520, "total": 1020},
        {"jour": 8, "matin": 500, "soir": 500, "total": 1000},
        {"jour": 9, "matin": 480, "soir": 480, "total": 960},
        {"jour": 10, "matin": 450, "soir": 450, "total": 900},
        {"jour": 11, "matin": 400, "soir": 400, "total": 800}
    ]}',
    'expert',
    NULL
FROM gaveurs_euralis
WHERE id IN (SELECT DISTINCT gaveur_id FROM lots_gavage WHERE itm <= 13.5 AND itm IS NOT NULL LIMIT 5)
ON CONFLICT DO NOTHING;

-- Cluster 4: Critique (ITM >17, courbe progressive)
INSERT INTO courbes_optimales_gaveurs (gaveur_id, cluster_performance, souche, duree_jours, itm_cible, courbe_json, source_generation, nb_lots_base)
SELECT
    id,
    4,
    'Mulard',
    11,
    15.5,
    '{"jours": [
        {"jour": 1, "matin": 200, "soir": 250, "total": 450},
        {"jour": 2, "matin": 250, "soir": 300, "total": 550},
        {"jour": 3, "matin": 300, "soir": 350, "total": 650},
        {"jour": 4, "matin": 350, "soir": 400, "total": 750},
        {"jour": 5, "matin": 380, "soir": 420, "total": 800},
        {"jour": 6, "matin": 400, "soir": 450, "total": 850},
        {"jour": 7, "matin": 420, "soir": 450, "total": 870},
        {"jour": 8, "matin": 420, "soir": 430, "total": 850},
        {"jour": 9, "matin": 400, "soir": 400, "total": 800},
        {"jour": 10, "matin": 380, "soir": 380, "total": 760},
        {"jour": 11, "matin": 350, "soir": 350, "total": 700}
    ]}',
    'expert',
    NULL
FROM gaveurs_euralis
WHERE id IN (SELECT DISTINCT gaveur_id FROM lots_gavage WHERE itm > 17 AND itm IS NOT NULL LIMIT 5)
ON CONFLICT DO NOTHING;

-- Afficher résumé
SELECT
    'courbes_optimales_gaveurs' as table_name,
    COUNT(*) as nb_courbes,
    COUNT(DISTINCT gaveur_id) as nb_gaveurs,
    COUNT(DISTINCT cluster_performance) as nb_clusters
FROM courbes_optimales_gaveurs;
