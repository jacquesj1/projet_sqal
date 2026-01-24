@echo off
REM Test endpoint courbe prédictive

echo Testing /api/courbes/predictive/lot/3468...
echo.

curl -X GET http://localhost:8000/api/courbes/predictive/lot/3468 -H "Content-Type: application/json"
echo.
echo.

echo ---
echo Si erreur 500: Verifier que backend est redémarre avec nouveau code
echo Si erreur 404: Lot 3468 n'a pas de courbe theorique validee
echo Si success: Devrait retourner courbe_predictive avec a_des_ecarts boolean
