@echo off
REM Test integration PySR - Sprint 4 Phase 1

echo ===================================================
echo Test Endpoint PySR - Generation Courbe Theorique
echo ===================================================
echo.

echo Test 1: Generation courbe standard (lot 3468)
echo ----------------------------------------------
curl -X POST "http://localhost:8000/api/courbes/theorique/generate-pysr?lot_id=3468&age_moyen=90&poids_foie_cible=400&duree_gavage=14&auto_save=false" -H "Content-Type: application/json"
echo.
echo.

echo Test 2: Generation avec race Mulard
echo ------------------------------------
curl -X POST "http://localhost:8000/api/courbes/theorique/generate-pysr?lot_id=3469&age_moyen=92&poids_foie_cible=450&duree_gavage=12&race=Mulard&auto_save=false" -H "Content-Type: application/json"
echo.
echo.

echo Test 3: Generation avec race Barbarie
echo ---------------------------------------
curl -X POST "http://localhost:8000/api/courbes/theorique/generate-pysr?lot_id=3470&age_moyen=88&poids_foie_cible=380&duree_gavage=14&race=Barbarie&auto_save=false" -H "Content-Type: application/json"
echo.
echo.

echo Test 4: Sauvegarde en DB (auto_save=true)
echo -------------------------------------------
curl -X POST "http://localhost:8000/api/courbes/theorique/generate-pysr?lot_id=9999&age_moyen=90&poids_foie_cible=400&duree_gavage=14&auto_save=true" -H "Content-Type: application/json"
echo.
echo.

echo ===================================================
echo Tous les tests termines
echo ===================================================
pause
