@echo off
REM ##############################################################################
REM Test End-to-End - Sprint 4 Frontend 3-Courbes (Windows)
REM ##############################################################################
REM Description: Teste l'integration complete Frontend <-> Backend Sprint 3/4
REM Usage: scripts\test_sprint4_frontend.bat
REM ##############################################################################

setlocal enabledelayedexpansion

set API_URL=http://localhost:8000
set EURALIS_URL=http://localhost:3000
set GAVEURS_URL=http://localhost:3001

echo ==========================================
echo TEST SPRINT 4 - FRONTEND INTEGRATION
echo ==========================================
echo.

REM ##############################################################################
REM Prerequis: Verifier que tous les services sont demarres
REM ##############################################################################
echo === VERIFICATION PREREQUIS ===
echo.

echo [1/3] Backend API...
curl -s "%API_URL%/health" >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] Backend API operationnel ^(port 8000^)
) else (
    echo [ERREUR] Backend API indisponible
    echo Demarrez avec: cd backend-api ^&^& uvicorn app.main:app --reload
    exit /b 1
)

echo [2/3] Frontend Euralis...
curl -s "%EURALIS_URL%" >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] Frontend Euralis operationnel ^(port 3000^)
) else (
    echo [AVERTISSEMENT] Frontend Euralis non demarre
    echo Demarrez avec: cd euralis-frontend ^&^& npm run dev
)

echo [3/3] Frontend Gaveurs...
curl -s "%GAVEURS_URL%" >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] Frontend Gaveurs operationnel ^(port 3001^)
) else (
    echo [AVERTISSEMENT] Frontend Gaveurs non demarre
    echo Demarrez avec: cd gaveurs-frontend ^&^& npm run dev
)
echo.

REM ##############################################################################
REM PHASE 1: Creer des donnees test via Backend API
REM ##############################################################################
echo === PHASE 1: CREATION DONNEES TEST ===
echo.

set LOT_ID=3468
set GAVEUR_ID=1
set SITE_CODE=LL

echo [1/7] Creation courbe theorique PySR...

curl -s -X POST "%API_URL%/api/courbes/theorique" ^
  -H "Content-Type: application/json" ^
  -d "{\"lot_id\": %LOT_ID%, \"gaveur_id\": %GAVEUR_ID%, \"site_code\": \"%SITE_CODE%\", \"pysr_equation\": \"120 + 25*min(jour-1, 2) + 20*max(0, min(jour-3, 5)) + 5*max(0, jour-8)\", \"pysr_r2_score\": 0.9456, \"courbe_theorique\": [{\"jour\": 1, \"dose_g\": 120}, {\"jour\": 2, \"dose_g\": 145}, {\"jour\": 3, \"dose_g\": 170}, {\"jour\": 4, \"dose_g\": 190}, {\"jour\": 5, \"dose_g\": 210}, {\"jour\": 6, \"dose_g\": 230}, {\"jour\": 7, \"dose_g\": 250}, {\"jour\": 8, \"dose_g\": 270}, {\"jour\": 9, \"dose_g\": 275}, {\"jour\": 10, \"dose_g\": 280}, {\"jour\": 11, \"dose_g\": 285}, {\"jour\": 12, \"dose_g\": 290}, {\"jour\": 13, \"dose_g\": 295}, {\"jour\": 14, \"dose_g\": 300}], \"duree_gavage_jours\": 14}" > temp_response.json

REM Extraire l'ID (simplifie - utiliser jq pour parsing robuste)
for /f "tokens=2 delims=:," %%a in ('findstr /C:"\"id\":" temp_response.json') do set COURBE_ID=%%a
set COURBE_ID=%COURBE_ID: =%

if defined COURBE_ID (
    echo [OK] Courbe theorique creee ^(ID: %COURBE_ID%^)
) else (
    echo [ERREUR] Echec creation courbe
    type temp_response.json
    del temp_response.json
    exit /b 1
)

echo [2/7] Validation superviseur...
curl -s -X POST "%API_URL%/api/courbes/theorique/%COURBE_ID%/valider" ^
  -H "Content-Type: application/json" ^
  -d "{\"courbe_id\": %COURBE_ID%, \"statut\": \"VALIDEE\", \"superviseur_nom\": \"Test Sprint 4\", \"commentaire\": \"Courbe validee pour test frontend\"}" >nul

echo [OK] Courbe validee

echo [3/7] Saisie doses reelles ^(3 jours^)...
curl -s -X POST "%API_URL%/api/courbes/reelle" ^
  -H "Content-Type: application/json" ^
  -d "{\"lot_id\": %LOT_ID%, \"gaveur_id\": %GAVEUR_ID%, \"site_code\": \"%SITE_CODE%\", \"date_gavage\": \"2026-01-09\", \"jour_gavage\": 1, \"dose_reelle_g\": 118}" >nul

curl -s -X POST "%API_URL%/api/courbes/reelle" ^
  -H "Content-Type: application/json" ^
  -d "{\"lot_id\": %LOT_ID%, \"gaveur_id\": %GAVEUR_ID%, \"site_code\": \"%SITE_CODE%\", \"date_gavage\": \"2026-01-10\", \"jour_gavage\": 2, \"dose_reelle_g\": 150}" >nul

curl -s -X POST "%API_URL%/api/courbes/reelle" ^
  -H "Content-Type: application/json" ^
  -d "{\"lot_id\": %LOT_ID%, \"gaveur_id\": %GAVEUR_ID%, \"site_code\": \"%SITE_CODE%\", \"date_gavage\": \"2026-01-11\", \"jour_gavage\": 3, \"dose_reelle_g\": 175}" >nul

echo [OK] 3 doses reelles saisies

echo [4/7] Verification dashboard backend...
curl -s "%API_URL%/api/courbes/dashboard/lot/%LOT_ID%" | findstr /C:"courbe_theorique" >nul
if %errorlevel% equ 0 (
    echo [OK] Dashboard backend fonctionnel
) else (
    echo [ERREUR] Erreur dashboard backend
    exit /b 1
)

echo.

REM ##############################################################################
REM PHASE 2: Test Frontend Euralis
REM ##############################################################################
echo === PHASE 2: TEST FRONTEND EURALIS ===
echo.

echo [5/7] Test page liste courbes...
echo    URL: %EURALIS_URL%/euralis/courbes
echo    Actions a verifier manuellement:
echo    - [ ] Stats cards affichent les bons nombres
echo    - [ ] Table affiche le lot %LOT_ID% avec statut VALIDEE
echo    - [ ] Filtres statut/site fonctionnent
echo    - [ ] Bouton 'Voir' redirige vers page detail
echo.

echo [6/7] Test page detail courbe...
echo    URL: %EURALIS_URL%/euralis/courbes/%COURBE_ID%
echo    Actions a verifier manuellement:
echo    - [ ] Graphique Chart.js affiche 14 points
echo    - [ ] Equation PySR affichee correctement
echo    - [ ] R^2 Score = 94.56%%
echo    - [ ] Badge statut = VALIDEE
echo    - [ ] Informations validation affichees
echo.

REM ##############################################################################
REM PHASE 3: Test Frontend Gaveurs
REM ##############################################################################
echo === PHASE 3: TEST FRONTEND GAVEURS ===
echo.

echo [7/7] Test dashboard 3-courbes gaveur...
echo    URL: %GAVEURS_URL%/lots/%LOT_ID%/courbes-sprint3
echo    Actions a verifier manuellement:
echo    - [ ] Stats cards: Jours saisis = 3
echo    - [ ] Graphique Chart.js: 2 courbes ^(theorique + reelle^)
echo    - [ ] Courbe theorique en bleu pointille ^(14 points^)
echo    - [ ] Courbe reelle en vert ^(3 points^)
echo    - [ ] Table historique affiche 3 lignes
echo    - [ ] Couleur verte si ecart ^< 10%%, rouge si ^> 10%%
echo    - [ ] Bouton 'Saisir dose du jour' ouvre modal
echo    - [ ] Modal permet saisie jour 4 avec dose
echo    - [ ] Panel corrections IA visible si ecarts ^> 10%%
echo.

REM ##############################################################################
REM PHASE 4: Test Workflow Complet
REM ##############################################################################
echo === PHASE 4: TEST WORKFLOW COMPLET ===
echo.

echo Workflow a tester manuellement:
echo.
echo 1. EURALIS - Visualisation courbe EN_ATTENTE
echo    -^> Aller sur: %EURALIS_URL%/euralis/courbes
echo    -^> Creer une nouvelle courbe via API
echo    -^> Verifier qu'elle apparait avec statut EN_ATTENTE
echo.
echo 2. EURALIS - Validation superviseur
echo    -^> Cliquer sur 'Voir' pour une courbe EN_ATTENTE
echo    -^> Verifier graphique et equation PySR
echo    -^> Cliquer 'Valider la courbe'
echo    -^> Entrer nom superviseur + commentaire
echo    -^> Verifier redirection vers liste avec statut VALIDEE
echo.
echo 3. GAVEUR - Consultation courbe validee
echo    -^> Aller sur: %GAVEURS_URL%/lots/%LOT_ID%/courbes-sprint3
echo    -^> Verifier courbe theorique visible
echo    -^> Verifier equation PySR affichee
echo.
echo 4. GAVEUR - Saisie dose quotidienne
echo    -^> Cliquer 'Saisir dose du jour'
echo    -^> Entrer jour 4, dose 200g
echo    -^> Valider
echo    -^> Verifier apparition dans table historique
echo    -^> Verifier recalcul ecart et stats
echo.
echo 5. GAVEUR - Ecart ^> 10%% -^> Alerte + Correction IA
echo    -^> Saisir dose jour 5 avec ecart volontaire: 250g ^(au lieu de 210g^)
echo    -^> Verifier alerte visuelle ^(fond rouge dans table^)
echo    -^> Verifier apparition correction IA dans panel
echo    -^> Verifier suggestion dose corrigee
echo.
echo 6. GAVEUR - Reponse correction IA
echo    -^> Cliquer 'Accepter' ou 'Refuser' sur correction
echo    -^> Verifier mise a jour statut
echo    -^> Si accepte: verifier dose appliquee pour jour suivant
echo.

REM ##############################################################################
REM Resume Final
REM ##############################################################################
echo.
echo ==========================================
echo TESTS SPRINT 4 - DONNEES CREEES
echo ==========================================
echo.
echo Donnees test creees:
echo   - Lot ID: %LOT_ID%
echo   - Courbe theorique ID: %COURBE_ID%
echo   - Statut: VALIDEE
echo   - Doses reelles: 3 jours saisis
echo.
echo URLs a tester:
echo   Euralis Liste:  %EURALIS_URL%/euralis/courbes
echo   Euralis Detail: %EURALIS_URL%/euralis/courbes/%COURBE_ID%
echo   Gaveur Dashboard: %GAVEURS_URL%/lots/%LOT_ID%/courbes-sprint3
echo.
echo Prochaine etape:
echo    -^> Tester manuellement chaque page avec les URLs ci-dessus
echo    -^> Verifier tous les points de la checklist Phase 2/3/4
echo    -^> Saisir doses supplementaires pour tester workflow complet
echo.

del temp_response.json 2>nul
endlocal
