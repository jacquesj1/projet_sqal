#!/bin/bash
# ============================================================================
# SQAL - Script de Lancement Automatique (Linux/Mac)
# Lance tous les services nécessaires pour tester le dashboard
# ============================================================================

set -e  # Exit on error

echo ""
echo "============================================================================"
echo "  SQAL Dashboard - Lancement Automatique"
echo "============================================================================"
echo ""

# Vérifier que Docker est accessible
if ! docker ps &> /dev/null; then
    echo "[ERREUR] Docker n'est pas lancé ou n'est pas accessible"
    echo "Veuillez démarrer Docker et réessayer"
    exit 1
fi

echo "[1/5] Démarrage de l'infrastructure Docker..."
docker-compose up -d timescaledb redis
echo "[OK] Infrastructure Docker démarrée"
echo ""

echo "[2/5] Attente démarrage TimescaleDB (10 secondes)..."
sleep 10

echo "[3/5] Démarrage du Backend FastAPI..."
cd backend_new
gnome-terminal -- bash -c "python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000; exec bash" 2>/dev/null || \
xterm -e "python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000" 2>/dev/null || \
osascript -e 'tell app "Terminal" to do script "cd \"'$(pwd)'\" && python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"' 2>/dev/null || \
echo "[WARNING] Impossible d'ouvrir un nouveau terminal. Lancez manuellement le backend dans un autre terminal."
cd ..

echo "[4/5] Attente démarrage Backend (5 secondes)..."
sleep 5

echo "[5/5] Démarrage du Simulateur ESP32..."
cd simulator
gnome-terminal -- bash -c "python esp32_simulator.py --url ws://localhost:8000/ws/sensors/ --rate 0.5; exec bash" 2>/dev/null || \
xterm -e "python esp32_simulator.py --url ws://localhost:8000/ws/sensors/ --rate 0.5" 2>/dev/null || \
osascript -e 'tell app "Terminal" to do script "cd \"'$(pwd)'\" && python esp32_simulator.py --url ws://localhost:8000/ws/sensors/ --rate 0.5"' 2>/dev/null || \
echo "[WARNING] Impossible d'ouvrir un nouveau terminal. Lancez manuellement le simulateur dans un autre terminal."
cd ..

echo ""
echo "============================================================================"
echo "  Tous les services sont lancés !"
echo "============================================================================"
echo ""
echo "Services actifs :"
echo "  - TimescaleDB    : localhost:5434"
echo "  - Redis          : localhost:6380"
echo "  - Backend API    : http://localhost:8000"
echo "  - Simulateur     : Envoie données via WebSocket"
echo ""
echo "Pour démarrer le Frontend :"
echo "  1. Ouvrir un nouveau terminal"
echo "  2. cd sqal"
echo "  3. npm run dev"
echo "  4. Ouvrir http://localhost:5173/dashboard"
echo ""
echo "Pour arrêter tous les services :"
echo "  - Fermer les terminaux"
echo "  - Exécuter : docker-compose down"
echo ""
