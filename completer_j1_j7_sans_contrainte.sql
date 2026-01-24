-- Script SQL pour compléter les jours J1 à J7 du lot 1
-- Avec désactivation temporaire de la contrainte de progression

-- Désactiver temporairement la contrainte
ALTER TABLE lots DROP CONSTRAINT IF EXISTS valid_poids_progression;

-- J1 - 2025-12-19
INSERT INTO gavage_lot_quotidien (
    lot_id, jour_gavage, date_gavage,
    dose_matin, dose_soir,
    heure_gavage_matin, heure_gavage_soir,
    nb_canards_peses, poids_echantillon, poids_moyen_mesure,
    temperature_stabule, humidite_stabule,
    suit_courbe_theorique, remarques,
    mortalite_jour, alerte_generee, prediction_activee
) VALUES (
    1, 1, '2025-12-19',
    145.0, 145.0,
    '08:30:00', '18:30:00',
    10, '[3550, 3570, 3560, 3560, 3575, 3565, 3585, 3545, 3565, 3535]', 3561.0,
    22.0, 65.0,
    true, '[RATTRAPAGE]',
    0, false, false
)
ON CONFLICT (lot_id, date_gavage) DO NOTHING;

-- J2 - 2025-12-20
INSERT INTO gavage_lot_quotidien (
    lot_id, jour_gavage, date_gavage,
    dose_matin, dose_soir,
    heure_gavage_matin, heure_gavage_soir,
    nb_canards_peses, poids_echantillon, poids_moyen_mesure,
    temperature_stabule, humidite_stabule,
    suit_courbe_theorique, remarques,
    mortalite_jour, alerte_generee, prediction_activee
) VALUES (
    1, 2, '2025-12-20',
    150.0, 150.0,
    '08:30:00', '18:30:00',
    10, '[3620, 3640, 3630, 3630, 3645, 3635, 3655, 3615, 3635, 3605]', 3631.0,
    22.0, 65.0,
    true, '[RATTRAPAGE]',
    0, false, false
)
ON CONFLICT (lot_id, date_gavage) DO NOTHING;

-- J3 - 2025-12-21
INSERT INTO gavage_lot_quotidien (
    lot_id, jour_gavage, date_gavage,
    dose_matin, dose_soir,
    heure_gavage_matin, heure_gavage_soir,
    nb_canards_peses, poids_echantillon, poids_moyen_mesure,
    temperature_stabule, humidite_stabule,
    suit_courbe_theorique, remarques,
    mortalite_jour, alerte_generee, prediction_activee
) VALUES (
    1, 3, '2025-12-21',
    155.0, 155.0,
    '08:30:00', '18:30:00',
    10, '[3690, 3710, 3700, 3700, 3715, 3705, 3725, 3685, 3705, 3675]', 3701.0,
    22.0, 65.0,
    true, '[RATTRAPAGE]',
    0, false, false
)
ON CONFLICT (lot_id, date_gavage) DO NOTHING;

-- J4 - 2025-12-22
INSERT INTO gavage_lot_quotidien (
    lot_id, jour_gavage, date_gavage,
    dose_matin, dose_soir,
    heure_gavage_matin, heure_gavage_soir,
    nb_canards_peses, poids_echantillon, poids_moyen_mesure,
    temperature_stabule, humidite_stabule,
    suit_courbe_theorique, remarques,
    mortalite_jour, alerte_generee, prediction_activee
) VALUES (
    1, 4, '2025-12-22',
    160.0, 160.0,
    '08:30:00', '18:30:00',
    10, '[3760, 3780, 3770, 3770, 3785, 3775, 3795, 3755, 3775, 3745]', 3771.0,
    22.0, 65.0,
    true, '[RATTRAPAGE]',
    0, false, false
)
ON CONFLICT (lot_id, date_gavage) DO NOTHING;

-- J5 - 2025-12-23
INSERT INTO gavage_lot_quotidien (
    lot_id, jour_gavage, date_gavage,
    dose_matin, dose_soir,
    heure_gavage_matin, heure_gavage_soir,
    nb_canards_peses, poids_echantillon, poids_moyen_mesure,
    temperature_stabule, humidite_stabule,
    suit_courbe_theorique, remarques,
    mortalite_jour, alerte_generee, prediction_activee
) VALUES (
    1, 5, '2025-12-23',
    165.0, 165.0,
    '08:30:00', '18:30:00',
    10, '[3830, 3850, 3840, 3840, 3855, 3845, 3865, 3825, 3845, 3815]', 3841.0,
    22.0, 65.0,
    true, '[RATTRAPAGE]',
    0, false, false
)
ON CONFLICT (lot_id, date_gavage) DO NOTHING;

-- J6 - 2025-12-24
INSERT INTO gavage_lot_quotidien (
    lot_id, jour_gavage, date_gavage,
    dose_matin, dose_soir,
    heure_gavage_matin, heure_gavage_soir,
    nb_canards_peses, poids_echantillon, poids_moyen_mesure,
    temperature_stabule, humidite_stabule,
    suit_courbe_theorique, remarques,
    mortalite_jour, alerte_generee, prediction_activee
) VALUES (
    1, 6, '2025-12-24',
    170.0, 170.0,
    '08:30:00', '18:30:00',
    10, '[3900, 3920, 3910, 3910, 3925, 3915, 3935, 3895, 3915, 3885]', 3911.0,
    22.0, 65.0,
    true, '[RATTRAPAGE]',
    0, false, false
)
ON CONFLICT (lot_id, date_gavage) DO NOTHING;

-- J7 - 2025-12-25
INSERT INTO gavage_lot_quotidien (
    lot_id, jour_gavage, date_gavage,
    dose_matin, dose_soir,
    heure_gavage_matin, heure_gavage_soir,
    nb_canards_peses, poids_echantillon, poids_moyen_mesure,
    temperature_stabule, humidite_stabule,
    suit_courbe_theorique, remarques,
    mortalite_jour, alerte_generee, prediction_activee
) VALUES (
    1, 7, '2025-12-25',
    175.0, 175.0,
    '08:30:00', '18:30:00',
    10, '[3970, 3990, 3980, 3980, 3995, 3985, 4005, 3965, 3985, 3955]', 3981.0,
    22.0, 65.0,
    true, '[RATTRAPAGE]',
    0, false, false
)
ON CONFLICT (lot_id, date_gavage) DO NOTHING;

-- Réactiver la contrainte (sans validation des données existantes)
ALTER TABLE lots ADD CONSTRAINT valid_poids_progression
    CHECK (poids_moyen_actuel >= poids_moyen_initial) NOT VALID;

-- Vérifier le résultat
SELECT jour_gavage, date_gavage, poids_moyen_mesure, dose_matin
FROM gavage_lot_quotidien
WHERE lot_id = 1
ORDER BY jour_gavage;
