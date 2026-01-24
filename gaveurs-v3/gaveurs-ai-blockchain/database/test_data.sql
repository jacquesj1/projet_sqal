-- ============================================
-- Données de test pour Système Gaveurs V2.1
-- ============================================

-- Insérer un gaveur de test
INSERT INTO gaveurs (nom, prenom, email, telephone, password_hash, adresse, certifications)
VALUES 
    ('Dupont', 'Jean', 'jean.dupont@gaveurs.fr', '+33612345678', 
     '$2b$12$KIXxKj8YP.VhU7xK.VhU7xK.VhU7xK.VhU7xK.VhU7xK.VhU7xK.VhU',
     '12 Route des Landes, 40000 Mont-de-Marsan',
     ARRAY['Label Rouge', 'IGP Sud-Ouest']),
    ('Martin', 'Sophie', 'sophie.martin@gaveurs.fr', '+33687654321',
     '$2b$12$KIXxKj8YP.VhU7xK.VhU7xK.VhU7xK.VhU7xK.VhU7xK.VhU7xK.VhU',
     '25 Chemin des Canards, 32000 Auch',
     ARRAY['Label Rouge']);

-- Insérer des abattoirs
INSERT INTO abattoirs (nom, adresse, ville, code_postal, numero_agrement, contact_telephone)
VALUES 
    ('Abattoir des Landes', '5 Zone Industrielle', 'Mont-de-Marsan', '40000', 
     'FR-40-001-001', '+33558123456'),
    ('Abattoir du Gers', '12 Route de Toulouse', 'Auch', '32000',
     'FR-32-001-001', '+33562123456');

-- Insérer des lots de maïs
INSERT INTO lot_mais (numero_lot, origine, date_reception, taux_humidite, qualite_note)
VALUES 
    ('MAIS-2024-001', 'Ferme Durand, Chalosse', NOW() - INTERVAL '10 days', 14.5, 9.2),
    ('MAIS-2024-002', 'Coopérative Landaise', NOW() - INTERVAL '5 days', 13.8, 9.5),
    ('MAIS-2024-003', 'Ferme Bio Gascogne', NOW() - INTERVAL '2 days', 14.2, 9.8);

-- Insérer des canards pour le gaveur Jean Dupont
INSERT INTO canards (numero_identification, gaveur_id, genetique, date_naissance, origine_elevage, numero_lot_canard, poids_initial, statut)
VALUES 
    ('FR-40-2024-0001', 1, 'mulard', NOW() - INTERVAL '95 days', 'Élevage Durand', 'LOT-2024-A', 3200, 'en_gavage'),
    ('FR-40-2024-0002', 1, 'mulard', NOW() - INTERVAL '95 days', 'Élevage Durand', 'LOT-2024-A', 3150, 'en_gavage'),
    ('FR-40-2024-0003', 1, 'mulard', NOW() - INTERVAL '95 days', 'Élevage Durand', 'LOT-2024-A', 3280, 'en_gavage'),
    ('FR-40-2024-0004', 1, 'barbarie', NOW() - INTERVAL '100 days', 'Élevage Bio Sud', 'LOT-2024-B', 2950, 'en_gavage'),
    ('FR-40-2024-0005', 1, 'barbarie', NOW() - INTERVAL '100 days', 'Élevage Bio Sud', 'LOT-2024-B', 3020, 'en_gavage');

-- Insérer des canards pour Sophie Martin
INSERT INTO canards (numero_identification, gaveur_id, genetique, date_naissance, origine_elevage, numero_lot_canard, poids_initial, statut)
VALUES 
    ('FR-32-2024-0001', 2, 'mulard', NOW() - INTERVAL '92 days', 'Ferme du Gers', 'LOT-2024-C', 3100, 'en_gavage'),
    ('FR-32-2024-0002', 2, 'mulard', NOW() - INTERVAL '92 days', 'Ferme du Gers', 'LOT-2024-C', 3220, 'en_gavage');

-- Générer des données de gavage historiques pour le canard 1
-- Jour 1
INSERT INTO gavage_data (
    time, canard_id, dose_matin, dose_soir, dose_theorique_matin, dose_theorique_soir,
    heure_gavage_matin, heure_gavage_soir, poids_matin, poids_soir,
    temperature_stabule, humidite_stabule, lot_mais_id
)
VALUES
    (NOW() - INTERVAL '13 days' + INTERVAL '8 hours', 1, 350, 370, 350, 360, '08:30', '18:30', 3200, 3255, 21.5, 62.0, 1),
    (NOW() - INTERVAL '12 days' + INTERVAL '8 hours', 1, 380, 400, 375, 385, '08:30', '18:30', 3255, 3320, 22.0, 60.0, 1),
    (NOW() - INTERVAL '11 days' + INTERVAL '8 hours', 1, 400, 420, 395, 410, '08:30', '18:30', 3320, 3400, 21.8, 61.0, 1),
    (NOW() - INTERVAL '10 days' + INTERVAL '8 hours', 1, 420, 450, 415, 435, '08:30', '18:30', 3400, 3490, 22.5, 63.0, 1),
    (NOW() - INTERVAL '9 days' + INTERVAL '8 hours', 1, 450, 470, 440, 460, '08:30', '18:30', 3490, 3595, 22.2, 62.5, 1),
    (NOW() - INTERVAL '8 days' + INTERVAL '8 hours', 1, 470, 490, 465, 480, '08:30', '18:30', 3595, 3710, 21.9, 61.8, 2),
    (NOW() - INTERVAL '7 days' + INTERVAL '8 hours', 1, 490, 510, 485, 500, '08:30', '18:30', 3710, 3835, 22.3, 62.2, 2),
    (NOW() - INTERVAL '6 days' + INTERVAL '8 hours', 1, 510, 530, 505, 520, '08:30', '18:30', 3835, 3970, 22.1, 61.5, 2),
    (NOW() - INTERVAL '5 days' + INTERVAL '8 hours', 1, 530, 550, 525, 540, '08:30', '18:30', 3970, 4115, 22.4, 62.8, 2),
    (NOW() - INTERVAL '4 days' + INTERVAL '8 hours', 1, 550, 570, 545, 560, '08:30', '18:30', 4115, 4270, 22.0, 62.0, 3),
    (NOW() - INTERVAL '3 days' + INTERVAL '8 hours', 1, 560, 580, 555, 575, '08:30', '18:30', 4270, 4435, 21.8, 61.2, 3),
    (NOW() - INTERVAL '2 days' + INTERVAL '8 hours', 1, 570, 590, 565, 585, '08:30', '18:30', 4435, 4610, 22.2, 62.5, 3),
    (NOW() - INTERVAL '1 day' + INTERVAL '8 hours', 1, 580, 600, 575, 595, '08:30', '18:30', 4610, 4795, 22.5, 63.0, 3);

-- Générer quelques corrections de doses
INSERT INTO corrections_doses (canard_id, date, dose_theorique, dose_reelle, ecart_absolu, ecart_pourcentage, correction_proposee, raison, impact_prevu)
VALUES
    (1, NOW() - INTERVAL '5 days', 525, 530, 5, 0.95, 'Écart mineur, aucune action requise', 'Léger sur-dosage', 'Impact minimal'),
    (1, NOW() - INTERVAL '3 days', 555, 560, 5, 0.90, 'Écart mineur, aucune action requise', 'Léger sur-dosage', 'Impact minimal');

-- Générer quelques alertes
INSERT INTO alertes (time, canard_id, niveau, type_alerte, message, valeur_mesuree, valeur_seuil, sms_envoye, acquittee)
VALUES
    (NOW() - INTERVAL '6 days', 1, 'info', 'temperature_elevee', 'Température stabule légèrement élevée', 24.5, 24.0, false, true),
    (NOW() - INTERVAL '2 days', 2, 'important', 'gain_poids_faible', 'Gain de poids inférieur à la moyenne', 45.0, 60.0, true, false);

-- Insérer un bloc genesis dans la blockchain
INSERT INTO blockchain (index, timestamp, type_evenement, canard_id, gaveur_id, donnees, hash_precedent, hash_actuel, signature_numerique)
VALUES
    (0, NOW() - INTERVAL '14 days', 'genesis', 0, 1, 
     '{"description": "Bloc Genesis - Système Gaveurs V2.1", "version": "2.1.0"}',
     '0',
     '000000a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6',
     'signature_genesis_test');

-- Afficher un résumé
SELECT 
    'Gaveurs' as table_name, COUNT(*) as count FROM gaveurs
UNION ALL
SELECT 'Abattoirs', COUNT(*) FROM abattoirs
UNION ALL
SELECT 'Lots de maïs', COUNT(*) FROM lot_mais
UNION ALL
SELECT 'Canards', COUNT(*) FROM canards
UNION ALL
SELECT 'Données gavage', COUNT(*) FROM gavage_data
UNION ALL
SELECT 'Corrections', COUNT(*) FROM corrections_doses
UNION ALL
SELECT 'Alertes', COUNT(*) FROM alertes
UNION ALL
SELECT 'Blockchain', COUNT(*) FROM blockchain;
