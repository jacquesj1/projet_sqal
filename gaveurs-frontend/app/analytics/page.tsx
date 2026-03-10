'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Activity,
  BarChart3,
  GitBranch,
  Calendar,
  Grid3x3,
  Boxes,
  Filter,
  X,
  Settings,
  RotateCcw,
} from 'lucide-react';
import { DEFAULT_GAVEUR_ID } from '@/lib/constants';
import HeatmapPerformance from '@/components/analytics/HeatmapPerformance';
import SankeyFluxProduction from '@/components/analytics/SankeyFluxProduction';
import TerrainKpiDashboard from '@/components/analytics/TerrainKpiDashboard';
import Breadcrumb from '@/components/Breadcrumb';

type TabId = 'terrain' | 'heatmap' | 'sankey';

interface AnalyticsSettings {
  periode: 7 | 14 | 30 | 0; // 0 = tous
  seuilAlerte: number; // Pourcentage d'écart pour alertes
  showLegend: boolean;
  showTooltips: boolean;
}

const DEFAULT_SETTINGS: AnalyticsSettings = {
  periode: 0,
  seuilAlerte: 15,
  showLegend: true,
  showTooltips: true,
};

export default function AnalyticsPage() {
  const searchParams = useSearchParams();
  const [selectedTab, setSelectedTab] = useState<TabId>('terrain');
  const [filteredLotId, setFilteredLotId] = useState<number | null>(null);
  const [lotName, setLotName] = useState<string>('');
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<AnalyticsSettings>(DEFAULT_SETTINGS);

  // Charger les paramètres depuis LocalStorage au montage
  useEffect(() => {
    const savedSettings = localStorage.getItem('analytics-settings');
    if (savedSettings) {
      try {
        setSettings(JSON.parse(savedSettings));
      } catch (err) {
        console.error('Erreur chargement paramètres:', err);
      }
    }
  }, []);

  // Sauvegarder les paramètres dans LocalStorage quand ils changent
  useEffect(() => {
    localStorage.setItem('analytics-settings', JSON.stringify(settings));
  }, [settings]);

  // Détecter le paramètre ?lot= dans l'URL
  useEffect(() => {
    const lotIdFromUrl = searchParams.get('lot');
    if (lotIdFromUrl) {
      const lotId = parseInt(lotIdFromUrl, 10);
      setFilteredLotId(lotId);
      // Charger le nom du lot pour affichage
      loadLotName(lotId);
    }
  }, [searchParams]);

  const loadLotName = async (lotId: number) => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const response = await fetch(`${apiUrl}/api/lots/${lotId}`);
      const lot = await response.json();
      setLotName(lot.code_lot || lot.nom || `Lot ${lotId}`);
    } catch (err) {
      console.error('Erreur chargement nom lot:', err);
      setLotName(`Lot ${lotId}`);
    }
  };

  const tabs = [
    {
      id: 'terrain' as TabId,
      label: 'Terrain (KPI)',
      icon: Activity,
      description: 'KPI simples + explications (conformité, régularité, saisie)'
    },
    {
      id: 'heatmap' as TabId,
      label: 'Performance Heatmap',
      icon: Grid3x3,
      description: 'Écart % vs théorique par jour et lot'
    },
    {
      id: 'sankey' as TabId,
      label: 'Flux Production',
      icon: GitBranch,
      description: 'Lots → Gaveur → Race → Statut → Qualité'
    },
  ];

  const renderVisualization = () => {
    const commonClass = 'mt-6';

    switch (selectedTab) {
      case 'terrain':
        return (
          <TerrainKpiDashboard
            gaveurId={DEFAULT_GAVEUR_ID}
            filteredLotId={filteredLotId}
            periode={settings.periode}
            seuilAlerte={settings.seuilAlerte}
            className={commonClass}
          />
        );
      case 'heatmap':
        return <HeatmapPerformance gaveurId={DEFAULT_GAVEUR_ID} filteredLotId={filteredLotId} className={commonClass} />;
      case 'sankey':
        return <SankeyFluxProduction gaveurId={DEFAULT_GAVEUR_ID} filteredLotId={filteredLotId} className={commonClass} />;
      default:
        return null;
    }
  };

  const renderExplanation = () => {
    const explanations = {
      heatmap: {
        title: "📊 Comment lire la Heatmap Performance",
        description: "La heatmap (carte de chaleur) affiche l'écart en % entre vos doses réelles et les doses théoriques.",
        sections: [
          {
            subtitle: "🎨 Échelle de couleurs",
            content: [
              "Rouge foncé (-20%) : Vous avez donné beaucoup moins que prévu - Risque de retard de croissance",
              "Orange (-10%) : Légèrement en-dessous - À surveiller",
              "Jaune (0%) : Parfait ! Vous suivez la courbe théorique",
              "Vert clair (+10%) : Légèrement au-dessus - Bon appétit des canards",
              "Vert foncé (+20%) : Beaucoup plus que prévu - Attention au surpoids"
            ]
          },
          {
            subtitle: "📖 Lecture du graphique",
            content: [
              "Axe horizontal (X) : Jours de gavage (J1, J2, J3...)",
              "Axe vertical (Y) : Vos différents lots",
              "Chaque case = un jour de gavage pour un lot spécifique",
              "Survolez une case pour voir les détails exacts"
            ]
          },
          {
            subtitle: "💡 Utilisation pratique",
            content: [
              "Repérez rapidement les jours où vous avez dévié du plan",
              "Identifiez les lots problématiques (beaucoup de rouge)",
              "Comparez vos lots entre eux",
              "Ajustez vos doses en conséquence pour les jours suivants"
            ]
          }
        ]
      },
      sankey: {
        title: "🌊 Comment lire le Diagramme Sankey",
        description: "Le Sankey montre le flux de vos canards à travers les différentes étapes de production.",
        sections: [
          {
            subtitle: "📊 Structure du flux",
            content: [
              "Colonne 1 (gauche) : Vos lots de départ",
              "Colonne 2 : Vous (gaveur) - centralise tous les lots",
              "Colonne 3 : Races de canards (Mulard, Barbarie...)",
              "Colonne 4 : Statuts (en gavage, terminé, abattu)",
              "Colonne 5 (droite) : Qualité finale si disponible"
            ]
          },
          {
            subtitle: "🎨 Largeur des flux",
            content: [
              "Plus le ruban est large = plus de canards passent par là",
              "Ruban fin = petit nombre de canards",
              "Les couleurs changent selon la catégorie",
              "Suivez visuellement le parcours de vos lots"
            ]
          },
          {
            subtitle: "💡 Utilisation pratique",
            content: [
              "Visualisez la répartition globale de votre production",
              "Identifiez quelle race domine vos lots",
              "Voyez combien de canards sont à chaque étape",
              "Comprenez le flux complet lot → gaveur → race → statut"
            ]
          }
        ]
      },
      calendrier: {
        title: "📅 Comment utiliser le Calendrier Planning",
        description: "Le calendrier affiche vos lots de gavage jour par jour dans une vue mensuelle interactive.",
        sections: [
          {
            subtitle: "📊 Navigation dans le calendrier",
            content: [
              "Mois affiché en haut : Utilisez les flèches ← → pour naviguer",
              "Bouton 'Aujourd'hui' : Retour rapide au mois en cours",
              "Jour en bleu foncé : Aujourd'hui",
              "Jours grisés : Jours du mois précédent/suivant"
            ]
          },
          {
            subtitle: "🎨 Codes visuels des événements",
            content: [
              "Badge vert : Lot en gavage actif - Jour de gavage affiché (ex: LOT-001 J5)",
              "Badge bleu : Lot terminé",
              "Badge orange : Lot en préparation",
              "Badge gris : Lot abattu",
              "Icône ⚠️ rouge : Alerte active sur un lot ce jour-là"
            ]
          },
          {
            subtitle: "💡 Utilisation interactive",
            content: [
              "Cliquez sur un jour avec événements : Ouvre le détail de tous les lots actifs ce jour",
              "Modal de détail : Affiche code lot, jour de gavage, nombre de canards, statut",
              "Actions rapides : Saisir dose, Voir courbes, Ouvrir analytics",
              "Plannifiez vos journées : Voyez d'un coup d'œil combien de lots vous gavez chaque jour",
              "Identifiez les pics d'activité : Jours avec plusieurs lots = surcharge potentielle"
            ]
          }
        ]
      },
      treemap: {
        title: "🗂️ Comment lire le Treemap",
        description: "Le Treemap affiche la répartition hiérarchique de vos canards par statut et race.",
        sections: [
          {
            subtitle: "📊 Structure hiérarchique",
            content: [
              "Niveau 1 (grands blocs) : Statut des lots (en gavage, terminé, préparation...)",
              "Niveau 2 (sous-blocs) : Races au sein de chaque statut",
              "Niveau 3 (petits blocs) : Lots individuels",
              "Taille du bloc = nombre de canards dans ce groupe"
            ]
          },
          {
            subtitle: "🎨 Codes couleurs",
            content: [
              "Vert : Lots en gavage actif",
              "Bleu : Lots terminés",
              "Orange : Lots en préparation",
              "Gris : Lots abattus",
              "Chaque couleur regroupe visuellement un même statut"
            ]
          },
          {
            subtitle: "💡 Utilisation pratique",
            content: [
              "Visualisez d'un coup d'œil la répartition globale",
              "Comparez la taille des blocs = comparez vos effectifs",
              "Identifiez quelle race domine dans quel statut",
              "Grand bloc = beaucoup de canards | Petit bloc = peu de canards",
              "Cliquez pour zoomer sur une catégorie spécifique"
            ]
          }
        ]
      },
      violin: {
        title: "🎻 Comment lire le Violin Plot",
        description: "Le Violin Plot montre la distribution des poids de foie pour chaque race.",
        sections: [
          {
            subtitle: "📊 Structure du graphique",
            content: [
              "Axe horizontal : Races de canards (Mulard, Barbarie...)",
              "Axe vertical : Poids de foie en grammes",
              "Forme de violon = distribution statistique",
              "Largeur du violon = fréquence (beaucoup de canards à ce poids)"
            ]
          },
          {
            subtitle: "🎨 Lecture de la forme",
            content: [
              "Violon large au milieu = la plupart des foies pèsent environ ce poids",
              "Violon mince = peu de canards à ce poids",
              "Violon symétrique = distribution normale, c'est bon signe",
              "Violon asymétrique = variabilité anormale à investiguer",
              "Ligne centrale = médiane (poids du milieu)"
            ]
          },
          {
            subtitle: "💡 Utilisation pratique",
            content: [
              "Comparez les races entre elles : quelle race donne les meilleurs foies ?",
              "Identifiez la variabilité : violon étroit = homogène (bien) | large = disparate",
              "Repérez les valeurs extrêmes (tout en haut ou en bas)",
              "Anticipez vos rendements selon la race choisie",
              "Ajustez vos doses si une race dévie de la norme attendue"
            ]
          }
        ]
      }
    };

    const explanation = (explanations as Record<string, typeof explanations.heatmap | undefined>)[selectedTab];
    if (!explanation) return null;

    return (
      <div className="mt-6 bg-gradient-to-br from-blue-50 to-purple-50 border-2 border-blue-300 rounded-xl p-6 shadow-lg">
        <h3 className="text-2xl font-bold text-blue-900 mb-4">{explanation.title}</h3>
        <p className="text-blue-800 mb-6 text-base leading-relaxed">{explanation.description}</p>

        <div className="space-y-6">
          {explanation.sections.map((section, idx) => (
            <div key={idx} className="bg-white rounded-lg p-5 shadow-md">
              <h4 className="text-lg font-bold text-gray-900 mb-3">{section.subtitle}</h4>
              <ul className="space-y-2">
                {section.content.map((item, itemIdx) => (
                  <li key={itemIdx} className="text-gray-700 flex items-start gap-2">
                    <span className="text-blue-600 font-bold mt-0.5">•</span>
                    <span className="leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-6 bg-yellow-100 border-2 border-yellow-400 rounded-lg p-4">
          <p className="text-yellow-900 font-semibold flex items-center gap-2">
            <span className="text-2xl">💡</span>
            <span>Astuce : Survolez les éléments du graphique pour afficher des informations détaillées en temps réel !</span>
          </p>
        </div>
      </div>
    );
  };

  const currentTab = tabs.find(t => t.id === selectedTab);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <Breadcrumb />
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <Activity className="w-8 h-8 text-purple-600" />
              <h1 className="text-3xl font-bold text-gray-900">Analytics Avancées D3.js</h1>
            </div>
            <div className="flex items-center gap-3">
              {/* Badge filtre lot */}
              {filteredLotId && (
                <div className="flex items-center gap-2 bg-purple-100 border-2 border-purple-300 rounded-lg px-4 py-2">
                  <Filter className="w-5 h-5 text-purple-700" />
                  <span className="font-semibold text-purple-900">
                    Filtré: {lotName}
                  </span>
                  <button
                    onClick={() => {
                      setFilteredLotId(null);
                      setLotName('');
                      window.history.pushState({}, '', '/analytics');
                    }}
                    className="ml-2 text-purple-700 hover:text-purple-900"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              )}
              {/* Bouton Paramètres */}
              <button
                onClick={() => setShowSettings(!showSettings)}
                className={`flex items-center gap-2 rounded-lg px-4 py-2 font-semibold transition-all shadow-md ${
                  showSettings
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-blue-600 border-2 border-blue-600 hover:bg-blue-50'
                }`}
              >
                <Settings className="w-5 h-5" />
                Paramètres
              </button>
            </div>
          </div>
          <p className="text-gray-600 text-lg">
            Visualisations interactives de vos données de production
            {filteredLotId && <span className="text-purple-700 font-semibold"> - Vue lot spécifique</span>}
          </p>
        </div>

        {/* Settings Panel */}
        {showSettings && (
          <div className="mb-6 bg-white rounded-lg shadow-lg border-2 border-blue-300 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <Settings className="w-6 h-6 text-blue-600" />
                Paramètres des Visualisations
              </h3>
              <button
                onClick={() => {
                  setSettings(DEFAULT_SETTINGS);
                }}
                className="flex items-center gap-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-lg transition-all"
              >
                <RotateCcw className="w-4 h-4" />
                Réinitialiser
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Période */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Période d'analyse
                </label>
                <select
                  value={settings.periode}
                  onChange={(e) => setSettings({ ...settings, periode: parseInt(e.target.value) as 7 | 14 | 30 | 0 })}
                  className="w-full rounded-lg border-2 border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none"
                >
                  <option value={0}>Tous les jours</option>
                  <option value={7}>7 derniers jours</option>
                  <option value={14}>14 derniers jours</option>
                  <option value={30}>30 derniers jours</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Filtre les données par période récente
                </p>
              </div>

              {/* Seuil d'alerte */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Seuil d'alerte (%)
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="5"
                    max="30"
                    step="5"
                    value={settings.seuilAlerte}
                    onChange={(e) => setSettings({ ...settings, seuilAlerte: parseInt(e.target.value) })}
                    className="flex-1"
                  />
                  <span className="text-lg font-bold text-blue-600 w-16 text-right">
                    {settings.seuilAlerte}%
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Écart minimal pour déclencher une alerte
                </p>
              </div>

              {/* Afficher la légende */}
              <div className="flex items-center justify-between bg-gray-50 rounded-lg p-4">
                <div>
                  <label className="text-sm font-semibold text-gray-700">
                    Afficher la légende
                  </label>
                  <p className="text-xs text-gray-500">
                    Légendes des couleurs et symboles
                  </p>
                </div>
                <button
                  onClick={() => setSettings({ ...settings, showLegend: !settings.showLegend })}
                  className={`w-14 h-8 rounded-full transition-all ${
                    settings.showLegend ? 'bg-blue-600' : 'bg-gray-300'
                  }`}
                >
                  <div
                    className={`w-6 h-6 bg-white rounded-full shadow-md transform transition-transform ${
                      settings.showLegend ? 'translate-x-7' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Afficher les tooltips */}
              <div className="flex items-center justify-between bg-gray-50 rounded-lg p-4">
                <div>
                  <label className="text-sm font-semibold text-gray-700">
                    Afficher les infobulles
                  </label>
                  <p className="text-xs text-gray-500">
                    Détails au survol de la souris
                  </p>
                </div>
                <button
                  onClick={() => setSettings({ ...settings, showTooltips: !settings.showTooltips })}
                  className={`w-14 h-8 rounded-full transition-all ${
                    settings.showTooltips ? 'bg-blue-600' : 'bg-gray-300'
                  }`}
                >
                  <div
                    className={`w-6 h-6 bg-white rounded-full shadow-md transform transition-transform ${
                      settings.showTooltips ? 'translate-x-7' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>

            <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-900">
                💾 <strong>Sauvegarde automatique</strong> : Vos paramètres sont enregistrés dans votre navigateur et restaurés à chaque visite.
              </p>
            </div>
          </div>
        )}

        {/* Tabs Navigation */}
        <div className="bg-white rounded-lg shadow-md p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = selectedTab === tab.id;

              return (
                <button
                  key={tab.id}
                  onClick={() => setSelectedTab(tab.id)}
                  className={`p-4 rounded-lg border-2 transition-all text-left ${
                    isActive
                      ? 'border-purple-500 bg-purple-50 shadow-md'
                      : 'border-gray-200 hover:border-purple-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <Icon
                      className={`w-6 h-6 flex-shrink-0 ${
                        isActive ? 'text-purple-600' : 'text-gray-400'
                      }`}
                    />
                    <div>
                      <h3
                        className={`font-semibold mb-1 ${
                          isActive ? 'text-purple-900' : 'text-gray-900'
                        }`}
                      >
                        {tab.label}
                      </h3>
                      <p className="text-sm text-gray-600">{tab.description}</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Lien vers Analytics Qualité */}
          <div className="mt-4 pt-4 border-t border-gray-200">
            <a
              href="/analytics/qualite"
              className="flex items-start gap-3 p-4 rounded-lg border-2 border-pink-300 bg-gradient-to-br from-pink-50 to-purple-50 hover:border-pink-500 hover:shadow-md transition-all"
            >
              <svg
                className="w-6 h-6 flex-shrink-0 text-pink-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <div>
                <h3 className="font-semibold mb-1 text-pink-900">
                  Analytics Qualité SQAL ✨
                </h3>
                <p className="text-sm text-pink-700">
                  Corrélations ITM vs Grade, indices spectraux, profils qualité
                </p>
              </div>
            </a>
          </div>
        </div>

        {/* Current Tab Info */}
        {currentTab && (
          <div className="bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-lg p-4 mb-6 shadow-lg">
            <div className="flex items-center gap-3">
              {(() => {
                const Icon = currentTab.icon;
                return <Icon className="w-6 h-6" />;
              })()}
              <div>
                <h2 className="text-xl font-bold">{currentTab.label}</h2>
                <p className="text-purple-100">{currentTab.description}</p>
              </div>
            </div>
          </div>
        )}

        {/* Visualization */}
        <div className="min-h-[600px]">
          {renderVisualization()}
        </div>

        {/* Info Panel */}
        <div className="mt-8 bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-purple-600" />
            À propos des visualisations D3.js
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold text-gray-800 mb-2">Interactivité</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Survolez les éléments pour voir les détails</li>
                <li>• Cliquez et glissez sur le réseau de corrélations</li>
                <li>• Explorez les données en profondeur</li>
                <li>• Toutes les visualisations sont responsive</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-gray-800 mb-2">Technologie</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• D3.js v7 pour visualisations avancées</li>
                <li>• SVG haute résolution</li>
                <li>• Animations fluides et transitions</li>
                <li>• Calculs statistiques en temps réel</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Detailed Explanation for Current Tab */}
        {renderExplanation()}
      </div>
    </div>
  );
}
