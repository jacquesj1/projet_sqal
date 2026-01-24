@echo off
REM Script de test de cohérence des clusters pour ALUSSE (gaveur_id 36)

echo ===================================
echo Test de cohérence des clusters
echo ===================================
echo.

echo 1. API Liste Gaveurs ML (courbes-optimales page):
curl -s "http://localhost:8000/api/euralis/ml/gaveurs-by-cluster-ml" | python -m json.tool | findstr /C:"\"gaveur_id\": 36" /C:"\"cluster\":" /C:"\"itm_moyen\":"
echo.

echo 2. API Performances (gaveurs page):
curl -s "http://localhost:8000/api/euralis/gaveurs/performances?limit=100" | python -m json.tool | findstr /C:"\"gaveur_id\": 36" /C:"\"cluster_id\":" /C:"\"cluster_label\":" /C:"\"itm_moyen\":"
echo.

echo 3. API Courbe Recommandée (courbes detail page):
curl -s "http://localhost:8000/api/euralis/ml/gaveur/36/courbe-recommandee?nb_canards=800&souche=Mulard" | python -m json.tool | findstr /C:"\"cluster\":"
echo.

echo ===================================
echo ATTENDU: Cluster 0 (Excellent) partout
echo ===================================
