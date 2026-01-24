@echo off
REM Script pour compléter les jours J1 à J10 du lot 1

set API_URL=http://localhost:8000/api/lots/gavage

echo Creation J1 - 2025-12-19...
curl -X POST %API_URL% -H "Content-Type: application/json" -d "{\"lot_id\":1,\"date_gavage\":\"2025-12-19\",\"dose_matin\":145,\"dose_soir\":145,\"heure_gavage_matin\":\"08:30\",\"heure_gavage_soir\":\"18:30\",\"nb_canards_peses\":10,\"poids_echantillon\":[3570,3590,3580,3560,3585,3565,3595,3555,3575,3550],\"temperature_stabule\":22,\"humidite_stabule\":65,\"suit_courbe_theorique\":true,\"remarques\":\"[RATTRAPAGE]\"}" -s
echo.

echo Creation J2 - 2025-12-20...
curl -X POST %API_URL% -H "Content-Type: application/json" -d "{\"lot_id\":1,\"date_gavage\":\"2025-12-20\",\"dose_matin\":150,\"dose_soir\":150,\"heure_gavage_matin\":\"08:30\",\"heure_gavage_soir\":\"18:30\",\"nb_canards_peses\":10,\"poids_echantillon\":[3640,3660,3650,3630,3655,3635,3665,3625,3645,3620],\"temperature_stabule\":22,\"humidite_stabule\":65,\"suit_courbe_theorique\":true,\"remarques\":\"[RATTRAPAGE]\"}" -s
echo.

echo Creation J3 - 2025-12-21...
curl -X POST %API_URL% -H "Content-Type: application/json" -d "{\"lot_id\":1,\"date_gavage\":\"2025-12-21\",\"dose_matin\":155,\"dose_soir\":155,\"heure_gavage_matin\":\"08:30\",\"heure_gavage_soir\":\"18:30\",\"nb_canards_peses\":10,\"poids_echantillon\":[3710,3730,3720,3700,3725,3705,3735,3695,3715,3690],\"temperature_stabule\":22,\"humidite_stabule\":65,\"suit_courbe_theorique\":true,\"remarques\":\"[RATTRAPAGE]\"}" -s
echo.

echo Creation J4 - 2025-12-22...
curl -X POST %API_URL% -H "Content-Type: application/json" -d "{\"lot_id\":1,\"date_gavage\":\"2025-12-22\",\"dose_matin\":160,\"dose_soir\":160,\"heure_gavage_matin\":\"08:30\",\"heure_gavage_soir\":\"18:30\",\"nb_canards_peses\":10,\"poids_echantillon\":[3780,3800,3790,3770,3795,3775,3805,3765,3785,3760],\"temperature_stabule\":22,\"humidite_stabule\":65,\"suit_courbe_theorique\":true,\"remarques\":\"[RATTRAPAGE]\"}" -s
echo.

echo Creation J5 - 2025-12-23...
curl -X POST %API_URL% -H "Content-Type: application/json" -d "{\"lot_id\":1,\"date_gavage\":\"2025-12-23\",\"dose_matin\":165,\"dose_soir\":165,\"heure_gavage_matin\":\"08:30\",\"heure_gavage_soir\":\"18:30\",\"nb_canards_peses\":10,\"poids_echantillon\":[3850,3870,3860,3840,3865,3845,3875,3835,3855,3830],\"temperature_stabule\":22,\"humidite_stabule\":65,\"suit_courbe_theorique\":true,\"remarques\":\"[RATTRAPAGE]\"}" -s
echo.

echo Creation J6 - 2025-12-24...
curl -X POST %API_URL% -H "Content-Type: application/json" -d "{\"lot_id\":1,\"date_gavage\":\"2025-12-24\",\"dose_matin\":170,\"dose_soir\":170,\"heure_gavage_matin\":\"08:30\",\"heure_gavage_soir\":\"18:30\",\"nb_canards_peses\":10,\"poids_echantillon\":[3920,3940,3930,3910,3935,3915,3945,3905,3925,3900],\"temperature_stabule\":22,\"humidite_stabule\":65,\"suit_courbe_theorique\":true,\"remarques\":\"[RATTRAPAGE]\"}" -s
echo.

echo Creation J7 - 2025-12-25...
curl -X POST %API_URL% -H "Content-Type: application/json" -d "{\"lot_id\":1,\"date_gavage\":\"2025-12-25\",\"dose_matin\":175,\"dose_soir\":175,\"heure_gavage_matin\":\"08:30\",\"heure_gavage_soir\":\"18:30\",\"nb_canards_peses\":10,\"poids_echantillon\":[3990,4010,4000,3980,4005,3985,4015,3975,3995,3970],\"temperature_stabule\":22,\"humidite_stabule\":65,\"suit_courbe_theorique\":true,\"remarques\":\"[RATTRAPAGE]\"}" -s
echo.

echo Creation J8 - 2025-12-26...
curl -X POST %API_URL% -H "Content-Type: application/json" -d "{\"lot_id\":1,\"date_gavage\":\"2025-12-26\",\"dose_matin\":180,\"dose_soir\":180,\"heure_gavage_matin\":\"08:30\",\"heure_gavage_soir\":\"18:30\",\"nb_canards_peses\":10,\"poids_echantillon\":[4060,4080,4070,4050,4075,4055,4085,4045,4065,4040],\"temperature_stabule\":22,\"humidite_stabule\":65,\"suit_courbe_theorique\":true,\"remarques\":\"[RATTRAPAGE]\"}" -s
echo.

echo Creation J9 - 2025-12-27...
curl -X POST %API_URL% -H "Content-Type: application/json" -d "{\"lot_id\":1,\"date_gavage\":\"2025-12-27\",\"dose_matin\":185,\"dose_soir\":185,\"heure_gavage_matin\":\"08:30\",\"heure_gavage_soir\":\"18:30\",\"nb_canards_peses\":10,\"poids_echantillon\":[4130,4150,4140,4120,4145,4125,4155,4115,4135,4110],\"temperature_stabule\":22,\"humidite_stabule\":65,\"suit_courbe_theorique\":true,\"remarques\":\"[RATTRAPAGE]\"}" -s
echo.

echo Creation J10 - 2025-12-28...
curl -X POST %API_URL% -H "Content-Type: application/json" -d "{\"lot_id\":1,\"date_gavage\":\"2025-12-28\",\"dose_matin\":190,\"dose_soir\":190,\"heure_gavage_matin\":\"08:30\",\"heure_gavage_soir\":\"18:30\",\"nb_canards_peses\":10,\"poids_echantillon\":[4200,4220,4210,4190,4215,4195,4225,4185,4205,4180],\"temperature_stabule\":22,\"humidite_stabule\":65,\"suit_courbe_theorique\":true,\"remarques\":\"[RATTRAPAGE]\"}" -s
echo.

echo.
echo ========================================
echo ✅ Historique J1-J10 complété !
echo ========================================
echo.
echo Rechargez la page http://localhost:3001/lots/1/gavage
echo.
pause
