'use client';

import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, CircleMarker } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix pour les icônes Leaflet manquantes en Next.js
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

// Coordonnées GPS réelles des sites Euralis
const SITES_EURALIS = [
  {
    code: 'LL',
    name: 'Lantic',
    lat: 48.6167,
    lng: -3.0833,
    region: 'Bretagne',
    description: 'Site de production Côtes-d\'Armor'
  },
  {
    code: 'LS',
    name: 'La Séguinière',
    lat: 47.0833,
    lng: -0.9333,
    region: 'Pays de la Loire',
    description: 'Site de production Maine-et-Loire'
  },
  {
    code: 'MT',
    name: 'Maubourguet',
    lat: 43.4667,
    lng: 0.0333,
    region: 'Hautes-Pyrénées',
    description: 'Site de production Sud-Ouest'
  }
];

// Couleurs par cluster (identiques à la version SVG)
const CLUSTER_COLORS = {
  0: '#10b981', // Excellent - Vert
  1: '#3b82f6', // Très bon - Bleu
  2: '#eab308', // Bon - Jaune
  3: '#f97316', // À améliorer - Orange
  4: '#ef4444'  // Critique - Rouge
};

const CLUSTER_LABELS = {
  0: 'Excellent',
  1: 'Très bon',
  2: 'Bon',
  3: 'À améliorer',
  4: 'Critique'
};

interface Gaveur {
  gaveur_id: number;
  nom: string;
  prenom?: string;
  site_code: string;
  cluster: number;
  itm_moyen: number;
  mortalite: number;
  performance_score: number;
  recommendation?: string;
}

interface ClustersMapLeafletProps {
  gaveurs: Gaveur[];
}

export default function ClustersMapLeaflet({ gaveurs }: ClustersMapLeafletProps) {
  const [isClient, setIsClient] = useState(false);

  // Leaflet ne fonctionne que côté client (pas SSR)
  useEffect(() => {
    setIsClient(true);

    // Fix icônes Leaflet
    const DefaultIcon = L.icon({
      iconUrl: icon.src,
      shadowUrl: iconShadow.src,
      iconSize: [25, 41],
      iconAnchor: [12, 41]
    });
    L.Marker.prototype.options.icon = DefaultIcon;
  }, []);

  if (!isClient) {
    return (
      <div className="bg-gray-50 rounded-lg p-8 text-center h-[600px] flex items-center justify-center">
        <div className="text-gray-600">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p>Chargement de la carte interactive...</p>
        </div>
      </div>
    );
  }

  // Centre de la France métropolitaine
  const centerFrance: [number, number] = [46.603354, 1.888334];

  return (
    <div className="relative h-[600px] w-full rounded-lg overflow-hidden shadow-lg">
      <MapContainer
        center={centerFrance}
        zoom={6}
        style={{ height: '100%', width: '100%' }}
        className="z-0"
      >
        {/* Fond de carte OpenStreetMap - Gratuit et sans clé API */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png"
        />

        {/* Sites Euralis - Marqueurs oranges */}
        {SITES_EURALIS.map((site) => (
          <Marker
            key={site.code}
            position={[site.lat, site.lng]}
            icon={L.divIcon({
              className: 'custom-site-marker',
              html: `
                <div class="bg-orange-500 text-white font-bold px-3 py-2 rounded-full shadow-lg border-2 border-white text-center">
                  <div class="text-sm">${site.code}</div>
                </div>
              `,
              iconSize: [60, 40],
              iconAnchor: [30, 20]
            })}
          >
            <Popup>
              <div className="p-2">
                <h3 className="font-bold text-lg text-orange-600">{site.name}</h3>
                <p className="text-sm text-gray-600">{site.region}</p>
                <p className="text-xs text-gray-500 mt-1">{site.description}</p>
                <p className="text-xs font-semibold text-gray-700 mt-2">
                  📍 {site.lat.toFixed(4)}°N, {Math.abs(site.lng).toFixed(4)}°{site.lng < 0 ? 'W' : 'E'}
                </p>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Gaveurs - Cercles colorés selon cluster */}
        {gaveurs.map((gaveur, idx) => {
          // Trouver le site correspondant au gaveur
          const site = SITES_EURALIS.find(s => s.code === gaveur.site_code) || SITES_EURALIS[idx % 3];

          // Position avec offset aléatoire autour du site (±0.2 degrés ≈ ±20km)
          // En production, utiliser vraies coordonnées GPS depuis la BD
          const offsetLat = ((idx * 17) % 100 - 50) * 0.004; // ±0.2°
          const offsetLng = ((idx * 23) % 100 - 50) * 0.004;

          const lat = site.lat + offsetLat;
          const lng = site.lng + offsetLng;

          return (
            <CircleMarker
              key={gaveur.gaveur_id || `gaveur-${idx}`}
              center={[lat, lng]}
              radius={12}
              pathOptions={{
                fillColor: CLUSTER_COLORS[gaveur.cluster as keyof typeof CLUSTER_COLORS],
                color: 'white',
                weight: 3,
                opacity: 1,
                fillOpacity: 0.8
              }}
            >
              <Popup>
                <div className="p-2 min-w-[200px]">
                  <h4 className="font-bold text-base text-gray-900">
                    {gaveur.nom} {gaveur.prenom || ''}
                  </h4>
                  <div className="mt-2 space-y-1 text-sm">
                    <p className="text-gray-600">
                      <span className="font-semibold">Site:</span> {site.name} ({site.code})
                    </p>
                    <p className="text-gray-600">
                      <span className="font-semibold">ITM:</span>{' '}
                      {gaveur.itm_moyen ? (gaveur.itm_moyen * 1000).toFixed(0) : 'N/A'} g/kg
                    </p>
                    <p className="text-gray-600">
                      <span className="font-semibold">Mortalité:</span>{' '}
                      {gaveur.mortalite != null ? gaveur.mortalite.toFixed(2) : 'N/A'}%
                    </p>
                    <div
                      className="mt-2 pt-2 border-t border-gray-200"
                      style={{
                        color: CLUSTER_COLORS[gaveur.cluster as keyof typeof CLUSTER_COLORS]
                      }}
                    >
                      <p className="font-bold">
                        {CLUSTER_LABELS[gaveur.cluster as keyof typeof CLUSTER_LABELS]}
                      </p>
                      <p className="text-xs">
                        Score: {gaveur.performance_score != null ? (gaveur.performance_score * 100).toFixed(0) : 'N/A'}%
                      </p>
                    </div>
                    {gaveur.recommendation && (
                      <p className="text-xs text-gray-500 mt-2 italic">
                        💡 {gaveur.recommendation}
                      </p>
                    )}
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>

      {/* Légende des clusters - Superposée sur la carte */}
      <div className="absolute bottom-4 right-4 bg-white rounded-lg shadow-xl p-4 border-2 border-gray-200 z-[1000]">
        <p className="font-semibold text-gray-900 mb-3 text-sm">Légende des Clusters</p>
        <div className="space-y-2">
          {Object.entries(CLUSTER_LABELS).map(([clusterId, label]) => {
            const count = gaveurs.filter(g => g.cluster === parseInt(clusterId)).length;
            if (count === 0) return null;

            return (
              <div key={clusterId} className="flex items-center gap-2">
                <div
                  className="w-4 h-4 rounded-full border-2 border-white shadow"
                  style={{ backgroundColor: CLUSTER_COLORS[parseInt(clusterId) as keyof typeof CLUSTER_COLORS] }}
                ></div>
                <span className="text-xs text-gray-700">
                  {label} <span className="font-semibold">({count})</span>
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Instructions d'utilisation */}
      <div className="absolute top-4 left-4 bg-blue-50 rounded-lg p-3 border border-blue-200 max-w-xs z-[1000]">
        <p className="text-xs text-blue-900">
          <strong>🗺️ Carte Interactive:</strong> Utilisez la molette pour zoomer,
          cliquez et glissez pour naviguer. Cliquez sur les marqueurs pour voir les détails.
        </p>
      </div>
    </div>
  );
}
