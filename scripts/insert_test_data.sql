-- ============================================================================
-- Insertion de données de test
-- ============================================================================

-- Insérer des gaveurs de test (si pas déjà existants)
INSERT INTO gaveurs (nom, prenom, email, telephone, password_hash, adresse, actif)
VALUES
    ('Dupont', 'Jean', 'jean.dupont@example.com', '0601020304', '$2b$12$test123', '1 Rue de la Ferme, 40000 Mont-de-Marsan', true),
    ('Martin', 'Pierre', 'pierre.martin@example.com', '0602030405', '$2b$12$test123', '5 Avenue du Foie Gras, 32000 Auch', true),
    ('Bernard', 'Paul', 'paul.bernard@example.com', '0603040506', '$2b$12$test123', '10 Chemin des Canards, 47000 Agen', true),
    ('Dubois', 'Marie', 'marie.dubois@example.com', '0604050607', '$2b$12$test123', '3 Impasse du Gavage, 40000 Dax', true),
    ('Leroy', 'Sophie', 'sophie.leroy@example.com', '0605060708', '$2b$12$test123', '8 Route de Landes, 32000 Condom', true)
ON CONFLICT (email) DO NOTHING;

-- Insérer des abattoirs
INSERT INTO abattoirs (nom, adresse, ville, code_postal, numero_agrement, contact_telephone)
VALUES
    ('Abattoir des Landes', '15 Zone Industrielle', 'Mont-de-Marsan', '40000', 'FR-40-123-001', '0558123456'),
    ('Abattoir du Gers', '20 Route de Toulouse', 'Auch', '32000', 'FR-32-456-002', '0562456789')
ON CONFLICT (numero_agrement) DO NOTHING;

-- Insérer des lots de maïs
INSERT INTO lot_mais (numero_lot, origine, date_reception, taux_humidite, qualite_note)
VALUES
    ('MAIS-2025-001', 'Ferme Laborde', NOW() - INTERVAL '30 days', 14.5, 8.5),
    ('MAIS-2025-002', 'Coopérative Sud-Ouest', NOW() - INTERVAL '25 days', 15.2, 8.0),
    ('MAIS-2025-003', 'Ferme Dufour', NOW() - INTERVAL '20 days', 13.8, 9.0)
ON CONFLICT (numero_lot) DO NOTHING;

-- Insérer des canards pour chaque gaveur
DO $$
DECLARE
    gaveur_rec RECORD;
    canard_counter INT;
BEGIN
    FOR gaveur_rec IN SELECT id, nom FROM gaveurs LOOP
        FOR canard_counter IN 1..10 LOOP
            INSERT INTO canards (
                numero_identification,
                gaveur_id,
                genetique,
                date_naissance,
                origine_elevage,
                numero_lot_canard,
                poids_initial,
                statut
            )
            VALUES (
                CONCAT('CAN-', gaveur_rec.id, '-', LPAD(canard_counter::TEXT, 3, '0')),
                gaveur_rec.id,
                CASE
                    WHEN canard_counter % 4 = 0 THEN 'mulard'
                    WHEN canard_counter % 4 = 1 THEN 'barbarie'
                    WHEN canard_counter % 4 = 2 THEN 'pekin'
                    ELSE 'mixte'
                END,
                NOW() - INTERVAL '90 days',
                CONCAT('Élevage ', gaveur_rec.nom),
                CONCAT('LOT-', gaveur_rec.id, '-2025'),
                3000 + (canard_counter * 50),
                'en_gavage'
            )
            ON CONFLICT (numero_identification) DO NOTHING;
        END LOOP;
    END LOOP;
END $$;

-- Insérer des données de gavage pour les 7 derniers jours
DO $$
DECLARE
    canard_rec RECORD;
    jour INT;
    jour_date TIMESTAMPTZ;
    lot_mais_id_val INT;
BEGIN
    -- Récupérer un lot de maïs
    SELECT id INTO lot_mais_id_val FROM lot_mais LIMIT 1;

    FOR canard_rec IN SELECT id, poids_initial FROM canards WHERE statut = 'en_gavage' LIMIT 25 LOOP
        FOR jour IN 0..6 LOOP
            jour_date := DATE_TRUNC('day', NOW()) - INTERVAL '1 day' * (6 - jour);

            INSERT INTO gavage_data (
                time,
                canard_id,
                dose_matin,
                dose_soir,
                dose_theorique_matin,
                dose_theorique_soir,
                heure_gavage_matin,
                heure_gavage_soir,
                poids_matin,
                poids_soir,
                temperature_stabule,
                humidite_stabule,
                lot_mais_id
            )
            VALUES (
                jour_date,
                canard_rec.id,
                200 + (jour * 30) + RANDOM() * 50,
                250 + (jour * 35) + RANDOM() * 60,
                200 + (jour * 30),
                250 + (jour * 35),
                '08:00:00'::TIME,
                '18:00:00'::TIME,
                canard_rec.poids_initial + (jour * 150) + RANDOM() * 100,
                canard_rec.poids_initial + (jour * 150) + 50 + RANDOM() * 100,
                18 + RANDOM() * 8,
                50 + RANDOM() * 30,
                lot_mais_id_val
            )
            ON CONFLICT DO NOTHING;
        END LOOP;
    END LOOP;
END $$;

-- Insérer quelques alertes de test
DO $$
DECLARE
    canard_rec RECORD;
BEGIN
    FOR canard_rec IN SELECT id FROM canards WHERE statut = 'en_gavage' LIMIT 5 LOOP
        INSERT INTO alertes (
            time,
            canard_id,
            niveau,
            type_alerte,
            message,
            valeur_mesuree,
            valeur_seuil,
            sms_envoye,
            acquittee
        )
        VALUES (
            NOW() - INTERVAL '2 hours',
            canard_rec.id,
            CASE
                WHEN RANDOM() < 0.3 THEN 'critique'
                WHEN RANDOM() < 0.6 THEN 'important'
                ELSE 'info'
            END,
            CASE
                WHEN RANDOM() < 0.5 THEN 'poids_faible'
                ELSE 'temperature'
            END,
            'Alerte générée automatiquement pour test',
            95.5,
            100.0,
            false,
            false
        );
    END LOOP;
END $$;

-- Afficher un résumé
SELECT
    (SELECT COUNT(*) FROM gaveurs) as nb_gaveurs,
    (SELECT COUNT(*) FROM canards) as nb_canards,
    (SELECT COUNT(*) FROM gavage_data) as nb_gavages,
    (SELECT COUNT(*) FROM alertes) as nb_alertes;

-- Message de confirmation
DO $$
BEGIN
    RAISE NOTICE '✅ Données de test insérées avec succès!';
    RAISE NOTICE '   - Gaveurs: % ', (SELECT COUNT(*) FROM gaveurs);
    RAISE NOTICE '   - Canards: %', (SELECT COUNT(*) FROM canards);
    RAISE NOTICE '   - Données de gavage: %', (SELECT COUNT(*) FROM gavage_data);
    RAISE NOTICE '   - Alertes: %', (SELECT COUNT(*) FROM alertes);
END $$;
