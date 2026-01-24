'use client';

import React, { useEffect, useState, useRef } from 'react';
import dynamic from 'next/dynamic';
import {
  TrendingUp,
  Users,
  AlertTriangle,
  Calendar,
  Brain,
  BarChart3,
  Sparkles,
  Target,
  Network
} from 'lucide-react';
import * as d3 from 'd3';
import { euralisAPI } from '@/lib/euralis/api';

// Import Leaflet dynamically (SSR disabled)
const ClustersMapLeaflet = dynamic(
  () => import('./ClustersMapLeaflet'),
  { ssr: false, loading: () => <div className="h-[600px] bg-gray-100 rounded-lg flex items-center justify-center"><p>Chargement de la carte...</p></div> }
);

interface Forecast {
  date: string;
  production_kg: number;
  lower_bound: number;
  upper_bound: number;
}

interface GaveurCluster {
  gaveur_id: number;
  nom: string;
  cluster: number;
  performance_score: number;
  itm_moyen: number;
  mortalite: number;
  recommendation: string;
}

interface Anomaly {
  lot_id: number;
  code_lot: string;
  anomaly_score: number;
  is_anomaly: boolean;
  reason: string;
}

interface OptimizationPlan {
  date_abattage: string;
  lots: Array<{
    code_lot: string;
    nb_canards: number;
    gaveur: string;
  }>;
  total_canards: number;
  efficiency_score: number;
}

interface NetworkData {
  nodes: Array<{ id: string; label: string; category: string; value: number }>;
  links: Array<{ source: string; target: string; correlation: number }>;
}

export default function AnalyticsPage() {
  const svgRef = useRef<SVGSVGElement>(null);
  const [forecasts, setForecasts] = useState<Forecast[]>([]);
  const [clusters, setClusters] = useState<GaveurCluster[]>([]);
  const [clusteringStats, setClusteringStats] = useState<any>(null);
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [optimizationPlans, setOptimizationPlans] = useState<OptimizationPlan[]>([]);
  const [networkData, setNetworkData] = useState<NetworkData | null>(null);
  const [correlationStats, setCorrelationStats] = useState<{ totalLots: number; avgItm: number; avgSigma: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'forecasts' | 'clusters' | 'anomalies' | 'optimization' | 'correlations'>('forecasts');

  useEffect(() => {
    loadAnalytics();
  }, []);

  useEffect(() => {
    if (activeTab === 'correlations' && networkData && svgRef.current) {
      renderNetwork();
    }
  }, [activeTab, networkData]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);

      // Charger prévisions 30 jours
      const forecastsData = await euralisAPI.getProductionForecasts(30);
      setForecasts(forecastsData);

      // Charger gaveurs avec leurs clusters ML (K-Means multi-critères)
      const clustersResponse = await euralisAPI.getGaveursWithClustersML(undefined, 5);
      console.log('🔍 DEBUG Gaveurs ML chargés:', clustersResponse);
      console.log('📊 Nombre de gaveurs:', clustersResponse.gaveurs?.length || 0);
      console.log('📊 Clustering stats:', clustersResponse.clustering_stats);
      setClusters(clustersResponse.gaveurs || []);
      setClusteringStats(clustersResponse.clustering_stats || null);

      // Charger anomalies
      const anomaliesData = await euralisAPI.getAnomalies();
      setAnomalies(anomaliesData.filter((a: Anomaly) => a.is_anomaly));

      // Charger plans optimisation
      const plansData = await euralisAPI.getOptimizationPlans(7);
      setOptimizationPlans(plansData);

      // Charger corrélations
      await loadCorrelations();

    } catch (error) {
      console.error('Erreur chargement analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCorrelations = async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

      // ⭐ NOUVEAU: Charger lots CSV avec TOUTES les variables de corrélation
      const response = await fetch(`${apiUrl}/api/euralis/ml/lots-correlation-data?limit=200`);
      const csvLots = await response.json();

      console.log(`📊 Lots CSV chargés: ${csvLots.length} lots avec données complètes`);

      if (csvLots.length < 10) {
        throw new Error(`Pas assez de lots pour analyse (${csvLots.length} lots, minimum 10 requis)`);
      }

      // ⭐ NOUVEAU: Charger données SQAL agrégées
      const sqalResponse = await fetch(`${apiUrl}/api/sqal/integration/lots-aggregated`);
      const sqalData = await sqalResponse.json();

      // Créer un index des données SQAL par lot_id
      const sqalByLot: { [key: number]: any } = {};
      for (const sqalLot of sqalData.lots) {
        sqalByLot[sqalLot.lot_id] = sqalLot;
      }

      console.log(`🔬 Données SQAL chargées: ${sqalData.total_lots} lots avec métriques qualité`);

      // Calculer statistiques
      const lotsWithItm = csvLots.filter((l: any) => l.itm != null);
      const avgItm = lotsWithItm.length > 0
        ? lotsWithItm.reduce((sum: number, l: any) => sum + parseFloat(l.itm), 0) / lotsWithItm.length
        : 0;

      const lotsWithSigma = csvLots.filter((l: any) => l.sigma != null);
      const avgSigma = lotsWithSigma.length > 0
        ? lotsWithSigma.reduce((sum: number, l: any) => sum + parseFloat(l.sigma), 0) / lotsWithSigma.length
        : 0;

      setCorrelationStats({
        totalLots: csvLots.length,
        avgItm: avgItm,
        avgSigma: avgSigma
      });

      // Collecter variables pour corrélations (CSV + SQAL)
      const variables: { [key: string]: number[] } = {
        // Variables CSV (production)
        itm: [],
        sigma: [],
        total_corn: [],
        nb_morts: [],
        poids_foie_reel: [],
        duree_gavage: [],
        nb_canards: [],
        // ⭐ NOUVELLES variables SQAL (qualité IoT)
        score_qualite: [],
        indice_fraicheur: [],
        indice_gras: [],
        indice_oxydation: [],
      };

      for (const lot of csvLots) {
        // Variables CSV (noms corrects depuis nouvel endpoint)
        if (lot.itm != null) variables.itm.push(parseFloat(lot.itm));
        if (lot.sigma != null) variables.sigma.push(parseFloat(lot.sigma));
        if (lot.total_corn_real != null) variables.total_corn.push(parseFloat(lot.total_corn_real));
        if (lot.nb_meg != null) variables.nb_morts.push(parseInt(lot.nb_meg));
        if (lot.poids_foie_moyen != null) variables.poids_foie_reel.push(parseFloat(lot.poids_foie_moyen));
        if (lot.duree_du_lot != null) variables.duree_gavage.push(parseInt(lot.duree_du_lot));
        if (lot.nb_accroches != null) variables.nb_canards.push(parseInt(lot.nb_accroches));

        // ⭐ Variables SQAL (si disponibles pour ce lot)
        const sqalLot = sqalByLot[lot.id];
        if (sqalLot) {
          if (sqalLot.score_qualite_moyen != null) variables.score_qualite.push(sqalLot.score_qualite_moyen);
          if (sqalLot.indice_fraicheur != null) variables.indice_fraicheur.push(sqalLot.indice_fraicheur);
          if (sqalLot.indice_qualite_gras != null) variables.indice_gras.push(sqalLot.indice_qualite_gras);
          if (sqalLot.indice_oxydation != null) variables.indice_oxydation.push(sqalLot.indice_oxydation);
        }
      }

      console.log('📊 Variables collectées:', Object.keys(variables).map(v => `${v}: ${variables[v].length} valeurs`));

      // Calculer corrélations de Pearson
      const data = calculateCorrelations(variables);
      setNetworkData(data);

    } catch (err) {
      console.error('Erreur chargement corrélations:', err);
    }
  };

  const calculateCorrelations = (variables: { [key: string]: number[] }): NetworkData => {
    const nodes: NetworkData['nodes'] = [];
    const links: NetworkData['links'] = [];

    // Filtrer uniquement les variables avec au moins 3 données (au lieu de 5)
    const varNames = Object.keys(variables).filter(v => variables[v].length >= 3);

    console.log('Variables disponibles:', Object.keys(variables).map(v => `${v}: ${variables[v].length} valeurs`));

    // Créer nœuds
    const labels: { [key: string]: string } = {
      // Variables CSV (production)
      itm: 'ITM',
      sigma: 'Homogénéité (σ)',
      total_corn: 'Dose totale maïs',
      nb_morts: 'Mortalité',
      poids_foie_reel: 'Poids foie réel',
      duree_gavage: 'Durée gavage',
      nb_canards: 'Nombre canards',
      // ⭐ Variables SQAL (qualité IoT)
      score_qualite: '🔬 Score qualité SQAL',
      indice_fraicheur: '🌡️ Fraîcheur IoT',
      indice_gras: '🧈 Qualité lipides',
      indice_oxydation: '⚗️ Oxydation',
    };

    const categories: { [key: string]: string } = {
      // Variables CSV
      itm: 'performance',
      sigma: 'performance',
      total_corn: 'gavage',
      nb_morts: 'gavage',
      poids_foie_reel: 'qualite',
      duree_gavage: 'gavage',
      nb_canards: 'lot',
      // ⭐ Variables SQAL → catégorie "sqal" (nouvelle)
      score_qualite: 'sqal',
      indice_fraicheur: 'sqal',
      indice_gras: 'sqal',
      indice_oxydation: 'sqal',
    };

    varNames.forEach(varName => {
      nodes.push({
        id: varName,
        label: labels[varName] || varName,
        category: categories[varName] || 'autre',
        value: variables[varName].length
      });
    });

    // Calculer corrélations entre toutes les paires
    for (let i = 0; i < varNames.length; i++) {
      for (let j = i + 1; j < varNames.length; j++) {
        const var1 = varNames[i];
        const var2 = varNames[j];

        const correlation = pearsonCorrelation(variables[var1], variables[var2]);

        // Ajouter lien si corrélation significative (|r| > 0.2 pour montrer plus de relations)
        if (Math.abs(correlation) > 0.2 && !isNaN(correlation)) {
          links.push({
            source: var1,
            target: var2,
            correlation: correlation
          });
        }
      }
    }

    console.log(`Network Graph: ${nodes.length} nœuds, ${links.length} liens`);

    return { nodes, links };
  };

  const pearsonCorrelation = (x: number[], y: number[]): number => {
    const n = Math.min(x.length, y.length);
    if (n === 0) return 0;

    const meanX = x.reduce((a, b) => a + b, 0) / n;
    const meanY = y.reduce((a, b) => a + b, 0) / n;

    let num = 0;
    let denX = 0;
    let denY = 0;

    for (let i = 0; i < n; i++) {
      const dx = x[i] - meanX;
      const dy = y[i] - meanY;
      num += dx * dy;
      denX += dx * dx;
      denY += dy * dy;
    }

    if (denX === 0 || denY === 0) return 0;
    return num / Math.sqrt(denX * denY);
  };

  const renderNetwork = () => {
    if (!svgRef.current || !networkData) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    // Larger canvas to fit all 11 variables comfortably
    const width = 1200;
    const height = 900;

    svg.attr('width', width).attr('height', height).attr('viewBox', `0 0 ${width} ${height}`);

    const g = svg.append('g');

    // Couleurs par catégorie
    const colorScale = d3.scaleOrdinal<string>()
      .domain(['performance', 'gavage', 'qualite', 'lot', 'sqal', 'autre'])
      .range(['#8b5cf6', '#10b981', '#ec4899', '#f59e0b', '#06b6d4', '#6b7280']); // Cyan pour SQAL

    // Simulation de force
    const simulation = d3.forceSimulation(networkData.nodes as any)
      .force('link', d3.forceLink(networkData.links).id((d: any) => d.id).distance(100))
      .force('charge', d3.forceManyBody().strength(-400))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(40));

    // Liens
    const link = g.append('g')
      .selectAll('line')
      .data(networkData.links)
      .join('line')
      .attr('stroke', d => d.correlation > 0 ? '#10b981' : '#ef4444')
      .attr('stroke-width', d => Math.abs(d.correlation) * 3)
      .attr('stroke-opacity', 0.6);

    // Nœuds
    const node = g.append('g')
      .selectAll('circle')
      .data(networkData.nodes)
      .join('circle')
      .attr('r', 20)
      .attr('fill', d => colorScale(d.category))
      .attr('stroke', '#fff')
      .attr('stroke-width', 2)
      .call(d3.drag<any, any>()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended) as any);

    // Labels
    const labels = g.append('g')
      .selectAll('text')
      .data(networkData.nodes)
      .join('text')
      .text(d => d.label)
      .attr('font-size', 11)
      .attr('font-weight', 'bold')
      .attr('text-anchor', 'middle')
      .attr('dy', 35)
      .attr('fill', '#1f2937');

    simulation.on('tick', () => {
      link
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);

      node
        .attr('cx', (d: any) => d.x)
        .attr('cy', (d: any) => d.y);

      labels
        .attr('x', (d: any) => d.x)
        .attr('y', (d: any) => d.y);
    });

    function dragstarted(event: any) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;
    }

    function dragged(event: any) {
      event.subject.fx = event.x;
      event.subject.fy = event.y;
    }

    function dragended(event: any) {
      if (!event.active) simulation.alphaTarget(0);
      event.subject.fx = null;
      event.subject.fy = null;
    }

    // Zoom
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 3])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    svg.call(zoom as any);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Brain className="h-12 w-12 animate-pulse text-blue-600 mx-auto" />
          <p className="mt-4 text-gray-600">Analyse des données en cours...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Brain className="h-8 w-8 text-blue-600" />
            Analytics & Intelligence
          </h1>
          <p className="text-gray-600 mt-2">
            Prévisions, détection d'anomalies et recommandations pilotées par IA
          </p>
        </div>
        <button
          onClick={loadAnalytics}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <Sparkles className="h-4 w-4" />
          Actualiser
        </button>
      </div>

      {/* KPIs Analytics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm">Prévision 7j</p>
              <p className="text-3xl font-bold mt-1">
                {forecasts.slice(0, 7).reduce((sum, f) => sum + f.production_kg, 0).toFixed(0)} kg
              </p>
            </div>
            <TrendingUp className="h-10 w-10 text-blue-200" />
          </div>
          <p className="text-xs text-blue-100 mt-3">Prophet ML Model</p>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg shadow-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100 text-sm">Clusters Gaveurs</p>
              <p className="text-3xl font-bold mt-1">
                {new Set(clusters.map(c => c.cluster)).size}
              </p>
            </div>
            <Users className="h-10 w-10 text-green-200" />
          </div>
          <p className="text-xs text-green-100 mt-3">
            {clusteringStats
              ? `K-Means ML (Silhouette: ${clusteringStats.silhouette_score?.toFixed(3) || 'N/A'})`
              : 'K-Means Clustering'}
          </p>
        </div>

        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg shadow-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-orange-100 text-sm">Anomalies Détectées</p>
              <p className="text-3xl font-bold mt-1">{anomalies.length}</p>
            </div>
            <AlertTriangle className="h-10 w-10 text-orange-200" />
          </div>
          <p className="text-xs text-orange-100 mt-3">Isolation Forest</p>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg shadow-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-100 text-sm">Plans Optimisés</p>
              <p className="text-3xl font-bold mt-1">{optimizationPlans.length}</p>
            </div>
            <Target className="h-10 w-10 text-purple-200" />
          </div>
          <p className="text-xs text-purple-100 mt-3">Hungarian Algorithm</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'forecasts', label: 'Prévisions', icon: TrendingUp },
            { id: 'clusters', label: 'Clusters Gaveurs', icon: Users },
            { id: 'anomalies', label: 'Anomalies', icon: AlertTriangle },
            { id: 'optimization', label: 'Optimisation', icon: Calendar },
            { id: 'correlations', label: 'Corrélations', icon: Network }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`
                flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm
                ${activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }
              `}
            >
              <tab.icon className="h-5 w-5" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Contenu Tabs */}
      <div className="mt-6">
        {activeTab === 'forecasts' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-blue-600" />
                Prévisions Production (30 jours)
              </h3>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead>
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Production Prévue</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Intervalle Confiance</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tendance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {forecasts.slice(0, 10).map((forecast, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {new Date(forecast.date).toLocaleDateString('fr-FR')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <span className="font-bold text-blue-600">
                            {forecast.production_kg.toFixed(1)} kg
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {forecast.lower_bound && forecast.upper_bound
                            ? `${forecast.lower_bound.toFixed(1)} - ${forecast.upper_bound.toFixed(1)} kg`
                            : 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {idx > 0 && (
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              forecast.production_kg > forecasts[idx - 1].production_kg
                                ? 'bg-green-100 text-green-800'
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {forecast.production_kg > forecasts[idx - 1].production_kg ? '↗' : '↘'}
                              {Math.abs(forecast.production_kg - forecasts[idx - 1].production_kg).toFixed(1)} kg
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-800">
                  💡 <strong>Modèle:</strong> Prophet de Meta - Détecte tendances, saisonnalité et changements de régime automatiquement
                </p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'clusters' && (
          <div className="space-y-6">
            {/* Carte Interactive des Clusters */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-600" />
                Cartographie Interactive des Gaveurs par Cluster
                <span className="ml-auto text-sm font-normal text-gray-500">
                  {clusters.length} gaveur{clusters.length > 1 ? 's' : ''} analysé{clusters.length > 1 ? 's' : ''}
                </span>
              </h3>

              {clusteringStats && (
                <div className="mb-4 p-4 bg-gradient-to-r from-green-50 to-blue-50 rounded-lg border border-green-200">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-semibold text-gray-900 mb-2">
                        🧠 Clustering {clusteringStats.method} - Qualité: {
                          clusteringStats.silhouette_score >= 0.5 ? '✅ Excellent' :
                          clusteringStats.silhouette_score >= 0.3 ? '✓ Bon' :
                          '⚠️ Acceptable'
                        }
                      </p>
                      <p className="text-xs text-gray-600 mb-1">
                        <strong>Silhouette Score:</strong> {clusteringStats.silhouette_score?.toFixed(3) || 'N/A'}
                        <span className="text-gray-500 ml-2">(0.5+ = excellent, 0.3-0.5 = bon)</span>
                      </p>
                      <p className="text-xs text-gray-600">
                        <strong>Critères analysés:</strong> {clusteringStats.features_used?.join(', ') || 'N/A'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-green-600">{clusteringStats.n_clusters}</p>
                      <p className="text-xs text-gray-500">clusters</p>
                    </div>
                  </div>
                </div>
              )}

              {clusters.length === 0 ? (
                <div className="bg-gray-50 rounded-lg p-8 text-center">
                  <Users className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-600 font-semibold">Aucune donnée de clustering disponible</p>
                  <p className="text-sm text-gray-500 mt-2">Les clusters de gaveurs seront affichés ici une fois l'analyse effectuée</p>
                  <p className="text-xs text-gray-400 mt-4 font-mono">
                    Endpoint API: GET /api/euralis/analytics/gaveur-clustering
                  </p>
                </div>
              ) : (
                <ClustersMapLeaflet gaveurs={clusters} />
              )}
            </div>

            {/* Insights IA Automatiques - Section d'explication */}
            <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg border-2 border-blue-200 p-6">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <Sparkles className="h-8 w-8 text-blue-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-gray-900 mb-2">
                    🧠 Insights IA Automatiques - Segmentation K-Means
                  </h3>
                  <p className="text-gray-700 mb-3">
                    L'algorithme K-Means analyse <strong>automatiquement</strong> les performances de tous vos gaveurs
                    et les classe en <strong>5 profils distincts</strong> selon leurs résultats (ITM, mortalité, régularité).
                  </p>
                  <div className="bg-white rounded-lg p-4 mt-3">
                    <p className="font-semibold text-gray-900 mb-2">🎯 À quoi cela sert-il ?</p>
                    <ul className="space-y-2 text-sm text-gray-700">
                      <li className="flex items-start gap-2">
                        <span className="text-green-600 font-bold mt-0.5">✓</span>
                        <span><strong>Pilotage personnalisé :</strong> Chaque profil reçoit des recommandations adaptées</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-green-600 font-bold mt-0.5">✓</span>
                        <span><strong>Priorisation :</strong> Identifiez rapidement les gaveurs nécessitant un accompagnement urgent</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-green-600 font-bold mt-0.5">✓</span>
                        <span><strong>Partage de bonnes pratiques :</strong> Les meilleurs gaveurs peuvent former les autres</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-green-600 font-bold mt-0.5">✓</span>
                        <span><strong>Suivi objectif :</strong> Mesure statistique de la performance collective</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {/* Profils de Clusters */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Users className="h-5 w-5 text-green-600" />
                Profils de Gaveurs Identifiés ({clusters.length} gaveurs analysés)
              </h3>

              {[...Array(5)].map((_, clusterIdx) => {
                const clusterMembers = clusters.filter(c => c.cluster === clusterIdx);
                if (clusterMembers.length === 0) return null;

                const avgPerformance = clusterMembers.reduce((sum, c) => sum + c.performance_score, 0) / clusterMembers.length;
                const avgItm = clusterMembers.reduce((sum, c) => sum + c.itm_moyen, 0) / clusterMembers.length;
                const avgMortalite = clusterMembers.reduce((sum, c) => sum + c.mortalite, 0) / clusterMembers.length;

                // Déterminer le label du cluster selon la performance
                let clusterLabel = '';
                let clusterColor = '';
                let clusterBgColor = '';
                let recommendations: string[] = [];
                let priority = '';
                let followupFrequency = '';

                if (avgPerformance > 0.8) {
                  clusterLabel = '⭐ Excellent';
                  clusterColor = 'text-green-800';
                  clusterBgColor = 'bg-green-100 border-green-300';
                  recommendations = [
                    "Identifier et documenter les best practices",
                    "Partager expertise avec autres gaveurs",
                    "Tester nouvelles souches ou techniques",
                    "Mentorat des gaveurs à améliorer"
                  ];
                  priority = 'Maintien excellence';
                  followupFrequency = 'Trimestriel';
                } else if (avgPerformance > 0.65) {
                  clusterLabel = '🌟 Très bon';
                  clusterColor = 'text-blue-800';
                  clusterBgColor = 'bg-blue-100 border-blue-300';
                  recommendations = [
                    "Formation avancée pour passer à Excellent",
                    "Optimisation doses pour réduire sigma",
                    "Partage d'expérience avec pairs",
                    "Audit annuel qualité"
                  ];
                  priority = 'Progression continue';
                  followupFrequency = 'Mensuel';
                } else if (avgPerformance > 0.5) {
                  clusterLabel = '👍 Bon';
                  clusterColor = 'text-yellow-800';
                  clusterBgColor = 'bg-yellow-100 border-yellow-300';
                  recommendations = [
                    "Suivi standard des lots",
                    "Formation continue sur nouveautés",
                    "Vérification conformité plans alimentation",
                    "Support technique si besoin"
                  ];
                  priority = 'Maintien performance';
                  followupFrequency = 'Trimestriel';
                } else if (avgPerformance > 0.35) {
                  clusterLabel = '⚠️ À améliorer';
                  clusterColor = 'text-orange-800';
                  clusterBgColor = 'bg-orange-100 border-orange-300';
                  recommendations = [
                    "Accompagnement renforcé par technicien",
                    "Formation pratique sur doses optimales",
                    "Audit détaillé des pratiques",
                    "Plan d'action personnalisé",
                    "Suivi hebdomadaire des KPIs"
                  ];
                  priority = 'Amélioration rapide';
                  followupFrequency = 'Hebdomadaire';
                } else {
                  clusterLabel = '🚨 Critique';
                  clusterColor = 'text-red-800';
                  clusterBgColor = 'bg-red-100 border-red-300';
                  recommendations = [
                    "Audit URGENT des conditions de gavage",
                    "Formation intensive immédiate",
                    "Supervision quotidienne",
                    "Vérification sanitaire bâtiments",
                    "Plan d'action correctif sous 7 jours",
                    "Réduction temporaire du nombre de canards"
                  ];
                  priority = 'INTERVENTION URGENTE';
                  followupFrequency = 'Quotidien';
                }

                return (
                  <div key={clusterIdx} className={`mb-6 border-2 rounded-lg p-6 ${clusterBgColor}`}>
                    {/* En-tête du cluster */}
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h4 className={`text-xl font-bold ${clusterColor}`}>
                          {clusterLabel}
                          <span className="ml-3 text-sm font-normal text-gray-600">
                            ({clusterMembers.length} gaveur{clusterMembers.length > 1 ? 's' : ''})
                          </span>
                        </h4>
                        <div className="mt-2 flex gap-4 text-sm">
                          <span className="font-medium">ITM moyen: <span className={clusterColor}>{(avgItm * 1000).toFixed(0)} g/kg</span></span>
                          <span className="font-medium">Mortalité: <span className={clusterColor}>{avgMortalite.toFixed(2)}%</span></span>
                          <span className="font-medium">Performance: <span className={clusterColor}>{(avgPerformance * 100).toFixed(0)}%</span></span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-semibold text-gray-600 mb-1">Priorité</div>
                        <div className={`text-sm font-bold ${clusterColor}`}>{priority}</div>
                        <div className="text-xs text-gray-600 mt-2">Suivi: {followupFrequency}</div>
                      </div>
                    </div>

                    {/* Recommandations */}
                    <div className="bg-white/70 rounded-lg p-4 mb-4">
                      <p className="font-semibold text-gray-900 mb-2 text-sm">💡 Actions recommandées :</p>
                      <ul className="space-y-1.5">
                        {recommendations.map((reco, idx) => (
                          <li key={idx} className="text-sm text-gray-700 flex items-start gap-2">
                            <span className={`font-bold ${clusterColor} mt-0.5`}>•</span>
                            <span>{reco}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Liste des gaveurs dans ce cluster */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {clusterMembers.map(gaveur => (
                        <div key={gaveur.gaveur_id} className="bg-white rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow border border-gray-200">
                          <div className="flex items-start justify-between mb-2">
                            <p className="font-semibold text-gray-900 text-sm">{gaveur.nom}</p>
                            <span className="text-xs px-2 py-0.5 bg-gray-100 rounded">
                              #{gaveur.gaveur_id}
                            </span>
                          </div>
                          <div className="space-y-1 text-xs">
                            <div className="flex justify-between">
                              <span className="text-gray-600">ITM:</span>
                              <span className="font-medium">{gaveur.itm_moyen ? (gaveur.itm_moyen * 1000).toFixed(0) : 'N/A'} g/kg</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Mortalité:</span>
                              <span className="font-medium">{gaveur.mortalite != null ? gaveur.mortalite.toFixed(2) : 'N/A'}%</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Score:</span>
                              <span className="font-bold text-blue-600">{gaveur.performance_score != null ? (gaveur.performance_score * 100).toFixed(0) : 'N/A'}%</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}

              <div className="mt-6 p-4 bg-blue-50 border-l-4 border-blue-500 rounded">
                <p className="text-sm text-blue-900">
                  <strong>📊 Algorithme K-Means :</strong> Utilise 5 critères (ITM moyen, Sigma, Mortalité, Nombre de lots, Régularité)
                  pour segmenter automatiquement les gaveurs en profils homogènes. La classification est objective et basée uniquement sur les données de production.
                </p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'anomalies' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-600" />
                Lots Anormaux Détectés
              </h3>

              {anomalies.length === 0 ? (
                <div className="text-center py-12">
                  <Sparkles className="h-12 w-12 text-green-500 mx-auto mb-3" />
                  <p className="text-gray-600">Aucune anomalie détectée - Tout va bien!</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {anomalies.map(anomaly => (
                    <div
                      key={anomaly.lot_id}
                      className="border-l-4 border-orange-500 bg-orange-50 p-4 rounded"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-gray-900">
                              Lot {anomaly.code_lot}
                            </span>
                            <span className="px-2 py-1 bg-orange-200 text-orange-800 text-xs rounded-full font-medium">
                              Score: {anomaly.anomaly_score.toFixed(2)}
                            </span>
                          </div>
                          <p className="text-sm text-gray-700 mt-2">{anomaly.reason}</p>
                        </div>
                        <button className="ml-4 px-3 py-1 text-sm bg-orange-600 text-white rounded hover:bg-orange-700">
                          Investiguer
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-6 p-4 bg-orange-50 rounded-lg">
                <p className="text-sm text-orange-800">
                  💡 <strong>Modèle:</strong> Isolation Forest détecte automatiquement les lots avec performances atypiques (ITM, mortalité, poids)
                </p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'optimization' && (
          <div className="space-y-6">
            {/* Explication Plans Abattage Optimisés */}
            <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-lg border-2 border-purple-200 p-6">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <Target className="h-8 w-8 text-purple-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-gray-900 mb-2">
                    🎯 Optimisation Abattages - Algorithme Hongrois (Hungarian)
                  </h3>
                  <p className="text-gray-700 mb-3">
                    L'algorithme Hungarian résout le <strong>problème d'affectation optimale</strong> : comment répartir les lots entre les abattoirs
                    pour minimiser les coûts de transport et maximiser l'efficacité de production.
                  </p>
                  <div className="bg-white rounded-lg p-4 mt-3">
                    <p className="font-semibold text-gray-900 mb-2">🎯 Objectifs d'optimisation :</p>
                    <ul className="space-y-2 text-sm text-gray-700">
                      <li className="flex items-start gap-2">
                        <span className="text-purple-600 font-bold mt-0.5">•</span>
                        <span><strong>Grouper les lots par date optimale</strong> d'abattage (maturité foies)</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-purple-600 font-bold mt-0.5">•</span>
                        <span><strong>Minimiser distances transport</strong> entre sites d'élevage et abattoirs</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-purple-600 font-bold mt-0.5">•</span>
                        <span><strong>Équilibrer charge</strong> entre abattoirs (capacités journalières)</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-purple-600 font-bold mt-0.5">•</span>
                        <span><strong>Respecter fenêtres qualité</strong> (éviter sur-gavage ou sous-gavage)</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {/* Plans d'abattage */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Calendar className="h-5 w-5 text-purple-600" />
                Plannings Optimisés (Prochains 7 jours)
              </h3>

              {optimizationPlans.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-lg">
                  <Target className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-600 font-medium mb-2">Aucun plan d'abattage calculé</p>
                  <p className="text-sm text-gray-500 mb-4">
                    L'optimisation nécessite des lots arrivant à maturité dans les prochains jours.
                  </p>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 max-w-2xl mx-auto text-left">
                    <p className="text-sm text-blue-900 mb-2"><strong>Comment générer des plans ?</strong></p>
                    <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                      <li>Avoir des lots en gavage proche de la fin (J+10 à J+14)</li>
                      <li>Définir les abattoirs disponibles avec leurs capacités</li>
                      <li>Lancer le calcul d'optimisation via l'API</li>
                    </ol>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {optimizationPlans.map((plan, idx) => (
                    <div key={idx} className="border-2 border-purple-200 rounded-lg p-5 hover:shadow-md transition-shadow bg-purple-50/30">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="bg-purple-600 text-white rounded-full w-12 h-12 flex items-center justify-center font-bold text-lg">
                            {idx + 1}
                          </div>
                          <div>
                            <p className="font-bold text-gray-900 text-lg">
                              {new Date(plan.date_abattage).toLocaleDateString('fr-FR', {
                                weekday: 'long',
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                              })}
                            </p>
                            <p className="text-sm text-gray-600 font-medium">
                              {plan.total_canards.toLocaleString()} canards répartis sur {plan.lots.length} lots
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs font-semibold text-gray-600 mb-1">Score Efficacité</div>
                          <span className={`px-4 py-2 rounded-lg text-sm font-bold inline-block ${
                            plan.efficiency_score > 0.8 ? 'bg-green-100 text-green-800 border-2 border-green-300' :
                            plan.efficiency_score > 0.6 ? 'bg-yellow-100 text-yellow-800 border-2 border-yellow-300' :
                            'bg-red-100 text-red-800 border-2 border-red-300'
                          }`}>
                            {(plan.efficiency_score * 100).toFixed(0)}%
                          </span>
                        </div>
                      </div>

                      {/* Détails lots affectés */}
                      <div className="bg-white rounded-lg p-4 border border-purple-200">
                        <p className="text-sm font-semibold text-gray-700 mb-3">
                          📦 Lots à abattre ce jour :
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          {plan.lots.map((lot, lotIdx) => (
                            <div key={lotIdx} className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg p-3 border border-gray-200">
                              <div className="flex items-start justify-between mb-1">
                                <p className="font-bold text-gray-900 text-sm">{lot.code_lot}</p>
                                <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded font-medium">
                                  #{lotIdx + 1}
                                </span>
                              </div>
                              <p className="text-xs text-gray-600 mb-1">👨‍🌾 {lot.gaveur}</p>
                              <p className="text-xs font-medium text-purple-700">{lot.nb_canards} canards</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Indicateurs du plan */}
                      <div className="mt-4 grid grid-cols-3 gap-3">
                        <div className="bg-white rounded-lg p-3 border border-gray-200 text-center">
                          <p className="text-xs text-gray-600 mb-1">Lots groupés</p>
                          <p className="text-2xl font-bold text-purple-600">{plan.lots.length}</p>
                        </div>
                        <div className="bg-white rounded-lg p-3 border border-gray-200 text-center">
                          <p className="text-xs text-gray-600 mb-1">Total canards</p>
                          <p className="text-2xl font-bold text-blue-600">{plan.total_canards.toLocaleString()}</p>
                        </div>
                        <div className="bg-white rounded-lg p-3 border border-gray-200 text-center">
                          <p className="text-xs text-gray-600 mb-1">Efficacité</p>
                          <p className={`text-2xl font-bold ${
                            plan.efficiency_score > 0.8 ? 'text-green-600' :
                            plan.efficiency_score > 0.6 ? 'text-yellow-600' : 'text-red-600'
                          }`}>
                            {(plan.efficiency_score * 100).toFixed(0)}%
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-6 p-4 bg-purple-50 border-l-4 border-purple-500 rounded">
                <p className="text-sm text-purple-900">
                  <strong>📊 Algorithme Hungarian :</strong> Résout le problème d'affectation optimale en temps polynomial O(n³).
                  Utilisé ici pour minimiser coûts transport + maximiser utilisation capacités abattoirs + respecter fenêtres qualité foies.
                </p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'correlations' && (
          <div className="space-y-6">
            {correlationStats && (
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-blue-50 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-blue-600 font-medium">Total Lots Analysés</p>
                      <p className="text-2xl font-bold text-blue-900 mt-1">{correlationStats.totalLots}</p>
                    </div>
                    <Network className="h-8 w-8 text-blue-400" />
                  </div>
                </div>

                <div className="bg-purple-50 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-purple-600 font-medium">ITM Moyen</p>
                      <p className="text-2xl font-bold text-purple-900 mt-1">{correlationStats.avgItm.toFixed(2)}</p>
                    </div>
                    <TrendingUp className="h-8 w-8 text-purple-400" />
                  </div>
                </div>

                <div className="bg-green-50 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-green-600 font-medium">Sigma Moyen</p>
                      <p className="text-2xl font-bold text-green-900 mt-1">{correlationStats.avgSigma.toFixed(3)}</p>
                    </div>
                    <Target className="h-8 w-8 text-green-400" />
                  </div>
                </div>
              </div>
            )}

            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Network className="h-5 w-5 text-blue-600" />
                Network Graph des Corrélations Globales (11 Variables)
              </h3>

              <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-4 mb-4 border border-blue-200">
                <p className="text-sm font-semibold text-gray-900 mb-2">🔍 Navigation dans le graphe :</p>
                <div className="grid grid-cols-3 gap-3 text-xs text-gray-700">
                  <div className="flex items-start gap-2">
                    <span className="font-bold text-blue-600">🖱️</span>
                    <span><strong>Déplacer :</strong> Cliquer-glisser sur le fond</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="font-bold text-blue-600">🔍</span>
                    <span><strong>Zoomer :</strong> Molette de la souris</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="font-bold text-blue-600">📍</span>
                    <span><strong>Déplacer nœud :</strong> Glisser un cercle</span>
                  </div>
                </div>
                <p className="text-xs text-gray-600 mt-2 italic">
                  💡 Le graphe affiche les <strong>11 variables</strong> : 7 production CSV + 4 qualité SQAL IoT
                </p>
              </div>

              <p className="text-sm text-gray-600 mb-4">
                Analyse des corrélations entre variables de production sur <strong>tous les lots CSV</strong> (données réelles Euralis 2024).
                Les liens verts indiquent une corrélation positive, les rouges une corrélation négative.
              </p>

              <div className="flex justify-center overflow-auto">
                <svg ref={svgRef} className="border-2 border-gray-300 rounded-lg shadow-inner bg-gray-50" style={{ maxWidth: '100%', height: 'auto' }}></svg>
              </div>

              <div className="mt-4 flex items-center justify-center gap-6 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-purple-500"></div>
                  <span className="text-gray-600">Performance</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-green-500"></div>
                  <span className="text-gray-600">Gavage</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-pink-500"></div>
                  <span className="text-gray-600">Qualité</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-orange-500"></div>
                  <span className="text-gray-600">Lot</span>
                </div>
              </div>

              <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                <h4 className="font-semibold text-blue-900 mb-2">Comment interpréter ce graph?</h4>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• <strong>Nœuds</strong>: Chaque variable analysée (production CSV + qualité SQAL)</li>
                  <li>• <strong>Couleurs nœuds</strong>:
                    <span className="ml-2">🟣 Performance</span>
                    <span className="ml-2">🟢 Gavage</span>
                    <span className="ml-2">🩷 Qualité</span>
                    <span className="ml-2">🟠 Lot</span>
                    <span className="ml-2">🔵 SQAL IoT</span>
                  </li>
                  <li>• <strong>Liens</strong>: Corrélation significative entre deux variables (|r| &gt; 0.2)</li>
                  <li>• <strong>Couleur lien</strong>: Vert = corrélation positive (↑↑), Rouge = corrélation négative (↑↓)</li>
                  <li>• <strong>Épaisseur lien</strong>: Plus épais = corrélation plus forte</li>
                  <li>• <strong>Objectif</strong>: Identifier leviers d'optimisation ET boucle fermée Production ↔ Qualité</li>
                </ul>
              </div>

              <div className="mt-4 p-4 bg-purple-50 rounded-lg">
                <h4 className="font-semibold text-purple-900 mb-2">💡 Exemples d'insights (Production + Qualité)</h4>
                <ul className="text-sm text-purple-800 space-y-1">
                  <li>• Si <strong>ITM ↑ et Poids foie ↓</strong> sont liés négativement → Mauvaise conversion alimentaire</li>
                  <li>• Si <strong>Sigma ↑ et Mortalité ↑</strong> sont liés positivement → Lots hétérogènes = plus de risques</li>
                  <li>• ⭐ Si <strong>ITM ↓ et Score qualité SQAL ↑</strong> sont liés → Bon ITM garantit qualité finale</li>
                  <li>• ⭐ Si <strong>Fraîcheur IoT ↑ et Oxydation ↓</strong> sont liés → Bonne conservation préserve qualité</li>
                </ul>
                <p className="text-sm text-purple-800 mt-3">
                  <strong>Avantage:</strong> Avec {correlationStats?.totalLots || 58} lots CSV + données SQAL IoT, les corrélations sont statistiquement robustes et créent une boucle fermée Production → Qualité pour orienter les décisions.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Insights Automatiques */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg shadow-lg p-6 text-white">
        <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <Brain className="h-6 w-6" />
          Insights IA Automatiques
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white/10 rounded-lg p-4 backdrop-blur">
            <p className="text-sm font-medium mb-2">📈 Tendance Production</p>
            <p className="text-2xl font-bold">
              +{((forecasts[6]?.production_kg - forecasts[0]?.production_kg) / forecasts[0]?.production_kg * 100).toFixed(1)}%
            </p>
            <p className="text-xs mt-1 text-blue-100">Sur les 7 prochains jours</p>
          </div>

          <div className="bg-white/10 rounded-lg p-4 backdrop-blur">
            <p className="text-sm font-medium mb-2">⭐ Meilleur Cluster</p>
            <p className="text-2xl font-bold">
              Cluster {clusters.reduce((best, c, idx, arr) => {
                const avgScore = arr.filter(x => x.cluster === c.cluster)
                  .reduce((sum, x) => sum + x.performance_score, 0) / arr.filter(x => x.cluster === c.cluster).length;
                return avgScore > best.score ? { cluster: c.cluster, score: avgScore } : best;
              }, { cluster: 0, score: 0 }).cluster + 1}
            </p>
            <p className="text-xs mt-1 text-blue-100">Performance moyenne la plus élevée</p>
          </div>

          <div className="bg-white/10 rounded-lg p-4 backdrop-blur">
            <p className="text-sm font-medium mb-2">🚨 Lots à Surveiller</p>
            <p className="text-2xl font-bold">{anomalies.length}</p>
            <p className="text-xs mt-1 text-blue-100">Comportement atypique détecté</p>
          </div>

          <div className="bg-white/10 rounded-lg p-4 backdrop-blur">
            <p className="text-sm font-medium mb-2">📅 Prochaine Optimisation</p>
            <p className="text-2xl font-bold">
              {optimizationPlans[0] ? new Date(optimizationPlans[0].date_abattage).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : 'N/A'}
            </p>
            <p className="text-xs mt-1 text-blue-100">
              {optimizationPlans[0]?.total_canards.toLocaleString()} canards
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
