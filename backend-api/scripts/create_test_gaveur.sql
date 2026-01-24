-- Créer un gaveur de test : jean.martin@gaveur.fr
-- Pour tester l'authentification sans Keycloak

-- Vérifier si le gaveur existe déjà
DO $$
DECLARE
    gaveur_exists INTEGER;
BEGIN
    SELECT COUNT(*) INTO gaveur_exists
    FROM gaveurs
    WHERE email = 'jean.martin@gaveur.fr';

    IF gaveur_exists = 0 THEN
        -- Créer le gaveur
        INSERT INTO gaveurs (
            nom,
            prenom,
            email,
            telephone,
            site_origine,
            actif,
            date_creation
        ) VALUES (
            'Martin',
            'Jean',
            'jean.martin@gaveur.fr',
            '0612345678',
            'LL',
            true,
            CURRENT_TIMESTAMP
        );

        RAISE NOTICE 'Gaveur créé : jean.martin@gaveur.fr (id: %)', currval('gaveurs_id_seq');

        -- Créer un lot de test pour ce gaveur
        INSERT INTO lots (
            code_lot,
            gaveur_id,
            site_origine,
            statut,
            nombre_canards,
            nombre_jours_gavage_ecoules,
            poids_moyen_actuel,
            objectif_poids_final,
            date_debut_gavage,
            date_creation
        ) VALUES (
            'LL_TEST_042',
            currval('gaveurs_id_seq'),
            'LL',
            'en_gavage',
            200,
            12,
            4854,
            5500,
            CURRENT_DATE - INTERVAL '12 days',
            CURRENT_TIMESTAMP
        );

        RAISE NOTICE 'Lot créé : LL_TEST_042 (id: %)', currval('lots_id_seq');

        -- Créer quelques gavages historiques
        INSERT INTO gavage_data (
            lot_id,
            jour_gavage,
            date_gavage,
            poids_moyen_mesure,
            nb_canards_peses,
            dose_matin,
            dose_soir,
            remarques
        )
        SELECT
            currval('lots_id_seq'),
            j,
            CURRENT_DATE - INTERVAL '12 days' + (j - 1) * INTERVAL '1 day',
            3500 + (j * 100) + (random() * 30),  -- Progression réaliste
            10,
            150 + (j * 5),
            150 + (j * 5),
            '[TEST] Jour ' || j || '/14'
        FROM generate_series(1, 12) AS j;

        RAISE NOTICE 'Données de gavage créées pour les 12 premiers jours';

    ELSE
        RAISE NOTICE 'Le gaveur jean.martin@gaveur.fr existe déjà (pas de création)';
    END IF;
END $$;

-- Vérifier le résultat
SELECT
    g.id,
    g.prenom || ' ' || g.nom AS nom_complet,
    g.email,
    g.telephone,
    g.site_origine,
    COUNT(l.id) AS nombre_lots
FROM gaveurs g
LEFT JOIN lots l ON g.id = l.gaveur_id
WHERE g.email = 'jean.martin@gaveur.fr'
GROUP BY g.id, g.prenom, g.nom, g.email, g.telephone, g.site_origine;
