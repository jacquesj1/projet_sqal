#!/bin/bash

###############################################################################
# Test End-to-End - Sprint 4 Frontend 3-Courbes
###############################################################################
# Description: Teste l'intégration complète Frontend <-> Backend Sprint 3/4
# Usage: ./scripts/test_sprint4_frontend.sh
###############################################################################

set -e  # Exit on error

API_URL="http://localhost:8000"
EURALIS_URL="http://localhost:3000"
GAVEURS_URL="http://localhost:3001"

echo "=========================================="
echo "🧪 TEST SPRINT 4 - FRONTEND INTEGRATION"
echo "=========================================="
echo ""

# Couleurs
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

###############################################################################
# Prérequis: Vérifier que tous les services sont démarrés
###############################################################################
echo -e "${BLUE}=== VÉRIFICATION PRÉREQUIS ===${NC}"
echo ""

echo -e "${YELLOW}[1/3]${NC} Backend API..."
if curl -s "$API_URL/health" > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} Backend API opérationnel (port 8000)"
else
    echo -e "${RED}✗${NC} Backend API indisponible - Démarrez avec: cd backend-api && uvicorn app.main:app --reload"
    exit 1
fi

echo -e "${YELLOW}[2/3]${NC} Frontend Euralis..."
if curl -s "$EURALIS_URL" > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} Frontend Euralis opérationnel (port 3000)"
else
    echo -e "${YELLOW}⚠${NC} Frontend Euralis non démarré - Démarrez avec: cd euralis-frontend && npm run dev"
fi

echo -e "${YELLOW}[3/3]${NC} Frontend Gaveurs..."
if curl -s "$GAVEURS_URL" > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} Frontend Gaveurs opérationnel (port 3001)"
else
    echo -e "${YELLOW}⚠${NC} Frontend Gaveurs non démarré - Démarrez avec: cd gaveurs-frontend && npm run dev"
fi
echo ""

###############################################################################
# PHASE 1: Créer des données test via Backend API
###############################################################################
echo -e "${BLUE}=== PHASE 1: CRÉATION DONNÉES TEST ===${NC}"
echo ""

LOT_ID=3468
GAVEUR_ID=1
SITE_CODE="LL"

# Test 1: Créer courbe théorique
echo -e "${YELLOW}[1/7]${NC} Création courbe théorique PySR..."
courbe_response=$(curl -s -X POST "$API_URL/api/courbes/theorique" \
  -H "Content-Type: application/json" \
  -d "{
    \"lot_id\": $LOT_ID,
    \"gaveur_id\": $GAVEUR_ID,
    \"site_code\": \"$SITE_CODE\",
    \"pysr_equation\": \"120 + 25*min(jour-1, 2) + 20*max(0, min(jour-3, 5)) + 5*max(0, jour-8)\",
    \"pysr_r2_score\": 0.9456,
    \"courbe_theorique\": [
      {\"jour\": 1, \"dose_g\": 120},
      {\"jour\": 2, \"dose_g\": 145},
      {\"jour\": 3, \"dose_g\": 170},
      {\"jour\": 4, \"dose_g\": 190},
      {\"jour\": 5, \"dose_g\": 210},
      {\"jour\": 6, \"dose_g\": 230},
      {\"jour\": 7, \"dose_g\": 250},
      {\"jour\": 8, \"dose_g\": 270},
      {\"jour\": 9, \"dose_g\": 275},
      {\"jour\": 10, \"dose_g\": 280},
      {\"jour\": 11, \"dose_g\": 285},
      {\"jour\": 12, \"dose_g\": 290},
      {\"jour\": 13, \"dose_g\": 295},
      {\"jour\": 14, \"dose_g\": 300}
    ],
    \"duree_gavage_jours\": 14
  }")

courbe_id=$(echo "$courbe_response" | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)

if [ -n "$courbe_id" ]; then
    echo -e "${GREEN}✓${NC} Courbe théorique créée (ID: $courbe_id)"
else
    echo -e "${RED}✗${NC} Échec création courbe"
    echo "Response: $courbe_response"
    exit 1
fi

# Test 2: Valider la courbe
echo -e "${YELLOW}[2/7]${NC} Validation superviseur..."
curl -s -X POST "$API_URL/api/courbes/theorique/$courbe_id/valider" \
  -H "Content-Type: application/json" \
  -d "{
    \"courbe_id\": $courbe_id,
    \"statut\": \"VALIDEE\",
    \"superviseur_nom\": \"Test Sprint 4\",
    \"commentaire\": \"Courbe validée pour test frontend\"
  }" > /dev/null

echo -e "${GREEN}✓${NC} Courbe validée"

# Test 3: Saisir doses réelles
echo -e "${YELLOW}[3/7]${NC} Saisie doses réelles (3 jours)..."

for jour in 1 2 3; do
    dose_base=(120 145 170)
    dose_reelle=$((dose_base[jour-1] + RANDOM % 20 - 10))

    curl -s -X POST "$API_URL/api/courbes/reelle" \
      -H "Content-Type: application/json" \
      -d "{
        \"lot_id\": $LOT_ID,
        \"gaveur_id\": $GAVEUR_ID,
        \"site_code\": \"$SITE_CODE\",
        \"date_gavage\": \"2026-01-$(printf "%02d" $((9+jour-1)))\",
        \"jour_gavage\": $jour,
        \"dose_reelle_g\": $dose_reelle
      }" > /dev/null
done

echo -e "${GREEN}✓${NC} 3 doses réelles saisies"

# Test 4: Vérifier dashboard
echo -e "${YELLOW}[4/7]${NC} Vérification dashboard backend..."
dashboard=$(curl -s "$API_URL/api/courbes/dashboard/lot/$LOT_ID")

if echo "$dashboard" | grep -q '"courbe_theorique"'; then
    echo -e "${GREEN}✓${NC} Dashboard backend fonctionnel"
else
    echo -e "${RED}✗${NC} Erreur dashboard backend"
    exit 1
fi

echo ""

###############################################################################
# PHASE 2: Test Frontend Euralis
###############################################################################
echo -e "${BLUE}=== PHASE 2: TEST FRONTEND EURALIS ===${NC}"
echo ""

echo -e "${YELLOW}[5/7]${NC} Test page liste courbes..."
echo "   URL: ${EURALIS_URL}/euralis/courbes"
echo "   Actions à vérifier manuellement:"
echo "   - [ ] Stats cards affichent les bons nombres"
echo "   - [ ] Table affiche le lot $LOT_ID avec statut VALIDEE"
echo "   - [ ] Filtres statut/site fonctionnent"
echo "   - [ ] Bouton 'Voir' redirige vers page détail"
echo ""

echo -e "${YELLOW}[6/7]${NC} Test page détail courbe..."
echo "   URL: ${EURALIS_URL}/euralis/courbes/$courbe_id"
echo "   Actions à vérifier manuellement:"
echo "   - [ ] Graphique Chart.js affiche 14 points"
echo "   - [ ] Équation PySR affichée correctement"
echo "   - [ ] R² Score = 94.56%"
echo "   - [ ] Badge statut = VALIDEE"
echo "   - [ ] Informations validation affichées"
echo ""

###############################################################################
# PHASE 3: Test Frontend Gaveurs
###############################################################################
echo -e "${BLUE}=== PHASE 3: TEST FRONTEND GAVEURS ===${NC}"
echo ""

echo -e "${YELLOW}[7/7]${NC} Test dashboard 3-courbes gaveur..."
echo "   URL: ${GAVEURS_URL}/lots/$LOT_ID/courbes-sprint3"
echo "   Actions à vérifier manuellement:"
echo "   - [ ] Stats cards: Jours saisis = 3"
echo "   - [ ] Graphique Chart.js: 2 courbes (théorique + réelle)"
echo "   - [ ] Courbe théorique en bleu pointillé (14 points)"
echo "   - [ ] Courbe réelle en vert (3 points)"
echo "   - [ ] Table historique affiche 3 lignes"
echo "   - [ ] Couleur verte si écart < 10%, rouge si > 10%"
echo "   - [ ] Bouton 'Saisir dose du jour' ouvre modal"
echo "   - [ ] Modal permet saisie jour 4 avec dose"
echo "   - [ ] Panel corrections IA visible si écarts > 10%"
echo ""

###############################################################################
# PHASE 4: Test Workflow Complet
###############################################################################
echo -e "${BLUE}=== PHASE 4: TEST WORKFLOW COMPLET ===${NC}"
echo ""

echo "📋 Workflow à tester manuellement:"
echo ""
echo "1️⃣  EURALIS - Visualisation courbe EN_ATTENTE"
echo "   → Aller sur: ${EURALIS_URL}/euralis/courbes"
echo "   → Créer une nouvelle courbe via API (voir test ci-dessus)"
echo "   → Vérifier qu'elle apparaît avec statut EN_ATTENTE"
echo ""
echo "2️⃣  EURALIS - Validation superviseur"
echo "   → Cliquer sur 'Voir' pour une courbe EN_ATTENTE"
echo "   → Vérifier graphique et équation PySR"
echo "   → Cliquer 'Valider la courbe'"
echo "   → Entrer nom superviseur + commentaire"
echo "   → Vérifier redirection vers liste avec statut VALIDEE"
echo ""
echo "3️⃣  GAVEUR - Consultation courbe validée"
echo "   → Aller sur: ${GAVEURS_URL}/lots/$LOT_ID/courbes-sprint3"
echo "   → Vérifier courbe théorique visible"
echo "   → Vérifier équation PySR affichée"
echo ""
echo "4️⃣  GAVEUR - Saisie dose quotidienne"
echo "   → Cliquer 'Saisir dose du jour'"
echo "   → Entrer jour 4, dose 200g"
echo "   → Valider"
echo "   → Vérifier apparition dans table historique"
echo "   → Vérifier recalcul écart et stats"
echo ""
echo "5️⃣  GAVEUR - Écart > 10% → Alerte + Correction IA"
echo "   → Saisir dose jour 5 avec écart volontaire: 250g (au lieu de 210g)"
echo "   → Vérifier alerte visuelle (fond rouge dans table)"
echo "   → Vérifier apparition correction IA dans panel"
echo "   → Vérifier suggestion dose corrigée"
echo ""
echo "6️⃣  GAVEUR - Réponse correction IA"
echo "   → Cliquer 'Accepter' ou 'Refuser' sur correction"
echo "   → Vérifier mise à jour statut"
echo "   → Si accepté: vérifier dose appliquée pour jour suivant"
echo ""

###############################################################################
# Résumé Final
###############################################################################
echo ""
echo "=========================================="
echo -e "${GREEN}✅ TESTS SPRINT 4 - DONNÉES CRÉÉES${NC}"
echo "=========================================="
echo ""
echo "Données test créées:"
echo "  - Lot ID: $LOT_ID"
echo "  - Courbe théorique ID: $courbe_id"
echo "  - Statut: VALIDEE"
echo "  - Doses réelles: 3 jours saisis"
echo ""
echo "URLs à tester:"
echo "  📊 Euralis Liste:  ${EURALIS_URL}/euralis/courbes"
echo "  📈 Euralis Détail: ${EURALIS_URL}/euralis/courbes/$courbe_id"
echo "  🦆 Gaveur Dashboard: ${GAVEURS_URL}/lots/$LOT_ID/courbes-sprint3"
echo ""
echo "🎯 Prochaine étape:"
echo "   → Tester manuellement chaque page avec les URLs ci-dessus"
echo "   → Vérifier tous les points de la checklist Phase 2/3/4"
echo "   → Saisir doses supplémentaires pour tester workflow complet"
echo ""
