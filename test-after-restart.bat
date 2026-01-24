@echo off
echo ================================================
echo Test Cluster ALUSSE apres redemarrage
echo ================================================
echo.

echo Attente que le backend soit pret...
timeout /t 5 /nobreak >nul

echo Test en cours...
curl -s "http://localhost:8000/api/euralis/ml/gaveur/36/courbe-recommandee?nb_canards=800&souche=Mulard" > temp_cluster.json

echo.
echo Resultat pour ALUSSE (gaveur_id 36):
python -m json.tool temp_cluster.json | findstr /C:"\"cluster\":"

del temp_cluster.json

echo.
echo ================================================
echo ATTENDU: "cluster": 0 (Excellent)
echo SI VOUS VOYEZ "cluster": 4, le backend n'est pas encore redemarre
echo ================================================
pause
