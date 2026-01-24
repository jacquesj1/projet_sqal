#!/bin/bash

# ============================================
# Système Gaveurs V2.1 - Script de démarrage
# ============================================

echo "🦆 Système Gaveurs V2.1 - Démarrage"
echo "===================================="

# Vérifier Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker n'est pas installé"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose n'est pas installé"
    exit 1
fi

echo "✅ Docker et Docker Compose détectés"

# Vérifier le fichier .env
if [ ! -f .env ]; then
    echo "⚠️  Fichier .env non trouvé"
    echo "📝 Copie de .env.example vers .env"
    cp .env.example .env
    echo ""
    echo "⚠️  IMPORTANT : Éditer le fichier .env avec vos credentials Twilio/OVH"
    echo "📝 Commande : nano .env"
    echo ""
    read -p "Appuyez sur Entrée après avoir configuré .env..."
fi

echo ""
echo "🚀 Démarrage des services Docker..."
docker-compose up -d

echo ""
echo "⏳ Attente de l'initialisation des services (30 secondes)..."
sleep 30

echo ""
echo "🔍 Vérification de l'état des services..."
docker-compose ps

echo ""
echo "✅ Système démarré avec succès !"
echo ""
echo "📍 Accès aux services :"
echo "   - Frontend       : http://localhost:3000"
echo "   - API Backend    : http://localhost:8000"
echo "   - Documentation  : http://localhost:8000/docs"
echo "   - Grafana        : http://localhost:3001 (admin/admin)"
echo "   - Prometheus     : http://localhost:9090"
echo "   - PgAdmin        : http://localhost:5050"
echo ""
echo "📊 Pour voir les logs en temps réel :"
echo "   docker-compose logs -f"
echo ""
echo "🛑 Pour arrêter le système :"
echo "   docker-compose down"
echo ""
echo "🔄 Pour redémarrer :"
echo "   docker-compose restart"
echo ""
