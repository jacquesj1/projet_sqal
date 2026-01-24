/**
 * Sensor Data Viewer Component
 * Displays complete sensor data (VL53L8CH + AS7341 + Fusion) in organized tabs
 */

import React, { useState } from 'react';
import { Card } from '../ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Badge } from '../ui/badge';
import type {
  SensorSample,
  VL53L8CHAnalysis,
  AS7341Analysis,
  FusionResult,
} from '../../types/sensor.types';

interface SensorDataViewerProps {
  sample: SensorSample;
}

export const SensorDataViewer: React.FC<SensorDataViewerProps> = ({ sample }) => {
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <div className="w-full space-y-4">
      {/* Header avec informations générales */}
      <Card className="p-6">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-bold">Sample {sample.sample_id}</h2>
            <p className="text-gray-500 text-sm mt-1">
              Device: {sample.device_id} | {new Date(sample.timestamp).toLocaleString()}
            </p>
          </div>
          <div className="text-right">
            <GradeBadge grade={sample.fusion.final_grade} />
            <p className="text-3xl font-bold mt-2">{(sample.fusion.final_score * 100).toFixed(1)}%</p>
            <p className="text-gray-500 text-sm">Quality Score</p>
          </div>
        </div>

        {/* Fusion Defects */}
        {sample.fusion.defects && sample.fusion.defects.length > 0 && (
          <div className="mt-4 p-4 bg-red-50 rounded-lg border border-red-200">
            <h3 className="font-semibold text-red-800 mb-2">Défauts Détectés ({sample.fusion.defects.length})</h3>
            <div className="flex flex-wrap gap-2">
              {sample.fusion.defects.map((defect, idx) => (
                <Badge key={idx} variant="destructive">{defect}</Badge>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* Onglets de données détaillées */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Vue d'ensemble</TabsTrigger>
          <TabsTrigger value="vl53l8ch">VL53L8CH (ToF)</TabsTrigger>
          <TabsTrigger value="as7341">AS7341 (Spectral)</TabsTrigger>
          <TabsTrigger value="fusion">Fusion</TabsTrigger>
          <TabsTrigger value="metadata">Metadata</TabsTrigger>
        </TabsList>

        {/* Vue d'ensemble */}
        <TabsContent value="overview">
          <OverviewTab sample={sample} />
        </TabsContent>

        {/* VL53L8CH Details */}
        <TabsContent value="vl53l8ch">
          <VL53L8CHTab data={sample.vl53l8ch} />
        </TabsContent>

        {/* AS7341 Details */}
        <TabsContent value="as7341">
          <AS7341Tab data={sample.as7341} />
        </TabsContent>

        {/* Fusion Details */}
        <TabsContent value="fusion">
          <FusionTab fusion={sample.fusion} />
        </TabsContent>

        {/* Metadata */}
        <TabsContent value="metadata">
          <MetadataTab meta={sample.meta} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

// ============================================================================
// Sub-components
// ============================================================================

const GradeBadge: React.FC<{ grade: string }> = ({ grade }) => {
  const colors: Record<string, string> = {
    'A+': 'bg-green-500',
    'A': 'bg-green-400',
    'B': 'bg-yellow-400',
    'C': 'bg-orange-400',
    'REJECT': 'bg-red-500',
  };

  return (
    <span className={`${colors[grade] || 'bg-gray-400'} text-white px-4 py-2 rounded-lg font-bold text-lg`}>
      {grade}
    </span>
  );
};

const MetricCard: React.FC<{ title: string; value: string | number; unit?: string; subtitle?: string }> = ({
  title,
  value,
  unit,
  subtitle,
}) => (
  <Card className="p-4">
    <div className="text-sm text-gray-500 mb-1">{title}</div>
    <div className="text-2xl font-bold">
      {value}
      {unit && <span className="text-base text-gray-500 ml-1">{unit}</span>}
    </div>
    {subtitle && <div className="text-xs text-gray-400 mt-1">{subtitle}</div>}
  </Card>
);

// ============================================================================
// Overview Tab
// ============================================================================

const OverviewTab: React.FC<{ sample: SensorSample }> = ({ sample }) => (
  <div className="space-y-6 mt-4">
    {/* Scores Overview */}
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <MetricCard
        title="VL53L8CH Score"
        value={(sample.vl53l8ch.quality_score * 100).toFixed(1)}
        unit="%"
        subtitle={`Grade: ${sample.vl53l8ch.grade}`}
      />
      <MetricCard
        title="AS7341 Score"
        value={(sample.as7341.quality_score * 100).toFixed(1)}
        unit="%"
        subtitle={`Grade: ${sample.as7341.grade}`}
      />
      <MetricCard
        title="Fusion Score"
        value={(sample.fusion.final_score * 100).toFixed(1)}
        unit="%"
        subtitle={`Grade: ${sample.fusion.final_grade}`}
      />
    </div>

    {/* Key Metrics */}
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">Métriques Clés</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard title="Volume" value={sample.vl53l8ch.volume_mm3.toFixed(1)} unit="mm³" />
        <MetricCard title="Hauteur Moy." value={sample.vl53l8ch.average_height_mm.toFixed(1)} unit="mm" />
        <MetricCard title="Fraîcheur" value={(sample.as7341.freshness_index * 100).toFixed(1)} unit="%" />
        <MetricCard title="Qualité Gras" value={(sample.as7341.fat_quality_index * 100).toFixed(1)} unit="%" />
      </div>
    </Card>

    {/* Defects Summary */}
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-3">Défauts VL53L8CH ({sample.vl53l8ch.defects.length})</h3>
        {sample.vl53l8ch.defects.length > 0 ? (
          <ul className="space-y-1">
            {sample.vl53l8ch.defects.map((defect, idx) => (
              <li key={idx} className="text-sm text-red-600">• {defect}</li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-500">Aucun défaut détecté</p>
        )}
      </Card>
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-3">Défauts AS7341 ({sample.as7341.defects.length})</h3>
        {sample.as7341.defects.length > 0 ? (
          <ul className="space-y-1">
            {sample.as7341.defects.map((defect, idx) => (
              <li key={idx} className="text-sm text-red-600">• {defect}</li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-500">Aucun défaut détecté</p>
        )}
      </Card>
    </div>
  </div>
);

// ============================================================================
// VL53L8CH Tab
// ============================================================================

const VL53L8CHTab: React.FC<{ data: VL53L8CHAnalysis }> = ({ data }) => (
  <div className="space-y-6 mt-4">
    {/* Basic Statistics */}
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">Statistiques de Base</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard title="Volume" value={data.volume_mm3.toFixed(2)} unit="mm³" />
        <MetricCard title="Surface" value={data.base_area_mm2.toFixed(2)} unit="mm²" />
        <MetricCard title="Hauteur Moy." value={data.average_height_mm.toFixed(2)} unit="mm" />
        <MetricCard title="Hauteur Max" value={data.max_height_mm.toFixed(2)} unit="mm" />
        <MetricCard title="Hauteur Min" value={data.min_height_mm.toFixed(2)} unit="mm" />
        <MetricCard title="Plage Hauteur" value={data.height_range_mm.toFixed(2)} unit="mm" />
        <MetricCard title="Uniformité" value={(data.surface_uniformity * 100).toFixed(1)} unit="%" />
        <MetricCard title="Quality Score" value={(data.quality_score * 100).toFixed(1)} unit="%" />
      </div>
    </Card>

    {/* Matrices (Raw Data) */}
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">Matrices 8x8 (Données Brutes)</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <MatrixVisualization title="Distance (mm)" matrix={data.distance_matrix} colorScheme="blue" />
        <MatrixVisualization title="Reflectance" matrix={data.reflectance_matrix} colorScheme="green" />
        <MatrixVisualization title="Amplitude" matrix={data.amplitude_matrix} colorScheme="purple" />
      </div>
    </Card>

    {/* Detailed Analysis */}
    {data.bins_analysis && (
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Analyse des Bins (Histogramme)</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard title="Nombre de Bins" value={data.bins_analysis.bin_count} />
          <MetricCard title="Multi-Peak" value={data.bins_analysis.multi_peak_detected ? 'Oui' : 'Non'} />
          <MetricCard title="Rugosité" value={(data.bins_analysis.roughness_score * 100).toFixed(1)} unit="%" />
          <MetricCard title="Qualité Signal" value={(data.bins_analysis.signal_quality * 100).toFixed(1)} unit="%" />
        </div>
      </Card>
    )}

    {data.reflectance_analysis && (
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Analyse Reflectance</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <MetricCard title="Reflectance Moy." value={data.reflectance_analysis.avg_reflectance.toFixed(1)} />
          <MetricCard
            title="Uniformité Reflectance"
            value={(data.reflectance_analysis.reflectance_uniformity * 100).toFixed(1)}
            unit="%"
          />
          <div className="col-span-2 md:col-span-1">
            {data.reflectance_analysis.optical_anomalies.length > 0 && (
              <div>
                <div className="text-sm text-gray-500 mb-2">Anomalies Optiques</div>
                {data.reflectance_analysis.optical_anomalies.map((anomaly, idx) => (
                  <Badge key={idx} variant="secondary" className="mr-1 mb-1">
                    {anomaly}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>
      </Card>
    )}

    {/* Score Breakdown */}
    {data.score_breakdown && (
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Décomposition du Score</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <ScoreBar title="Volume" score={data.score_breakdown.volume_score} />
          <ScoreBar title="Uniformité" score={data.score_breakdown.uniformity_score} />
          <ScoreBar title="Reflectance" score={data.score_breakdown.reflectance_score} />
          <ScoreBar title="Amplitude" score={data.score_breakdown.amplitude_score} />
          <ScoreBar title="Pénalité Défauts" score={1 - data.score_breakdown.defect_penalty} negative />
        </div>
      </Card>
    )}
  </div>
);

// ============================================================================
// AS7341 Tab
// ============================================================================

const AS7341Tab: React.FC<{ data: AS7341Analysis }> = ({ data }) => (
  <div className="space-y-6 mt-4">
    {/* Quality Indices */}
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">Indices de Qualité</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <ScoreBar title="Fraîcheur" score={data.freshness_index} />
        <ScoreBar title="Qualité Gras" score={data.fat_quality_index} />
        <ScoreBar title="Oxydation" score={1 - data.oxidation_index} negative />
        <ScoreBar title="Uniformité Couleur" score={data.color_uniformity} />
      </div>
    </Card>

    {/* Spectral Channels */}
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">Canaux Spectraux (Données Brutes)</h3>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <ChannelBar name="F1 (415nm)" value={data.channels.F1_415nm} color="violet" />
        <ChannelBar name="F2 (445nm)" value={data.channels.F2_445nm} color="indigo" />
        <ChannelBar name="F3 (480nm)" value={data.channels.F3_480nm} color="blue" />
        <ChannelBar name="F4 (515nm)" value={data.channels.F4_515nm} color="cyan" />
        <ChannelBar name="F5 (555nm)" value={data.channels.F5_555nm} color="green" />
        <ChannelBar name="F6 (590nm)" value={data.channels.F6_590nm} color="yellow" />
        <ChannelBar name="F7 (630nm)" value={data.channels.F7_630nm} color="orange" />
        <ChannelBar name="F8 (680nm)" value={data.channels.F8_680nm} color="red" />
        <ChannelBar name="Clear" value={data.channels.Clear} color="gray" />
        <ChannelBar name="NIR" value={data.channels.NIR} color="gray" />
      </div>
      <div className="grid grid-cols-2 gap-4 mt-4">
        <MetricCard title="Integration Time" value={data.integration_time} unit="ms" />
        <MetricCard title="Gain" value={data.gain} unit="x" />
      </div>
    </Card>

    {/* Spectral Analysis */}
    {data.spectral_analysis && (
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Analyse Spectrale</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
          <MetricCard title="Intensité Totale" value={data.spectral_analysis.total_intensity.toFixed(0)} />
          <MetricCard
            title="Longueur d'onde Dominante"
            value={data.spectral_analysis.dominant_wavelength.toFixed(0)}
            unit="nm"
          />
          <MetricCard
            title="Uniformité Spectrale"
            value={(data.spectral_analysis.spectral_uniformity * 100).toFixed(1)}
            unit="%"
          />
        </div>
        <h4 className="font-semibold mb-2 text-sm">Ratios Spectraux</h4>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <MetricCard
            title="Violet/Orange"
            value={data.spectral_analysis.spectral_ratios.violet_orange_ratio.toFixed(3)}
            subtitle="Oxydation"
          />
          <MetricCard
            title="Bleu/Rouge"
            value={data.spectral_analysis.spectral_ratios.blue_red_ratio.toFixed(3)}
            subtitle="Fraîcheur"
          />
          <MetricCard
            title="Vert/Rouge"
            value={data.spectral_analysis.spectral_ratios.green_red_ratio.toFixed(3)}
            subtitle="Couleur"
          />
          <MetricCard
            title="NIR/Clear"
            value={data.spectral_analysis.spectral_ratios.nir_clear_ratio.toFixed(3)}
            subtitle="Densité"
          />
          <MetricCard
            title="Jaune/Rouge"
            value={data.spectral_analysis.spectral_ratios.yellow_red_ratio.toFixed(3)}
          />
          <MetricCard
            title="Cyan/Orange"
            value={data.spectral_analysis.spectral_ratios.cyan_orange_ratio.toFixed(3)}
          />
        </div>
      </Card>
    )}

    {/* Color Analysis */}
    {data.color_analysis && (
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Analyse Couleur</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <div className="text-sm text-gray-500 mb-2">RGB</div>
            <div
              className="w-full h-20 rounded border-2 border-gray-300"
              style={{
                backgroundColor: `rgb(${data.color_analysis.rgb.r}, ${data.color_analysis.rgb.g}, ${data.color_analysis.rgb.b})`,
              }}
            />
            <div className="text-xs text-gray-500 mt-1">
              R:{data.color_analysis.rgb.r} G:{data.color_analysis.rgb.g} B:{data.color_analysis.rgb.b}
            </div>
          </div>
          <MetricCard title="Couleur Dominante" value={data.color_analysis.dominant_color} />
          <MetricCard
            title="Température Couleur"
            value={data.color_analysis.color_temperature_k.toFixed(0)}
            unit="K"
          />
          <MetricCard
            title="Pureté Couleur"
            value={(data.color_analysis.color_purity * 100).toFixed(1)}
            unit="%"
          />
        </div>
      </Card>
    )}

    {/* Score Breakdown */}
    {data.score_breakdown && (
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Décomposition du Score</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <ScoreBar title="Fraîcheur" score={data.score_breakdown.freshness_score} />
          <ScoreBar title="Qualité Gras" score={data.score_breakdown.fat_quality_score} />
          <ScoreBar title="Oxydation" score={1 - data.score_breakdown.oxidation_score} negative />
          <ScoreBar title="Couleur" score={data.score_breakdown.color_score} />
          <ScoreBar title="Cohérence Spectrale" score={data.score_breakdown.spectral_consistency_score} />
        </div>
      </Card>
    )}
  </div>
);

// ============================================================================
// Fusion Tab
// ============================================================================

const FusionTab: React.FC<{ fusion: FusionResult }> = ({ fusion }) => (
  <div className="space-y-6 mt-4">
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">Résultat de Fusion Multi-Capteurs</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard title="Score Final" value={(fusion.final_score * 100).toFixed(1)} unit="%" />
        <MetricCard title="Grade Final" value={fusion.final_grade} />
        <MetricCard title="Nombre de Défauts" value={fusion.defects.length} />
      </div>
    </Card>

    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">Contributions par Capteur</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <div className="text-sm text-gray-500 mb-2">VL53L8CH (ToF)</div>
          <div className="flex items-center">
            <div className="flex-1 bg-gray-200 rounded-full h-8">
              <div
                className="bg-blue-500 h-8 rounded-full flex items-center justify-center text-white font-semibold"
                style={{ width: `${fusion.vl53l8ch_score * 100}%` }}
              >
                {(fusion.vl53l8ch_score * 100).toFixed(1)}%
              </div>
            </div>
          </div>
        </div>
        <div>
          <div className="text-sm text-gray-500 mb-2">AS7341 (Spectral)</div>
          <div className="flex items-center">
            <div className="flex-1 bg-gray-200 rounded-full h-8">
              <div
                className="bg-orange-500 h-8 rounded-full flex items-center justify-center text-white font-semibold"
                style={{ width: `${fusion.as7341_score * 100}%` }}
              >
                {(fusion.as7341_score * 100).toFixed(1)}%
              </div>
            </div>
          </div>
        </div>
      </div>
    </Card>

    {fusion.defects.length > 0 && (
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Défauts Détectés</h3>
        <div className="flex flex-wrap gap-2">
          {fusion.defects.map((defect, idx) => (
            <Badge key={idx} variant="destructive" className="px-3 py-1">
              {defect}
            </Badge>
          ))}
        </div>
      </Card>
    )}
  </div>
);

// ============================================================================
// Metadata Tab
// ============================================================================

const MetadataTab: React.FC<{ meta: any }> = ({ meta }) => (
  <div className="space-y-6 mt-4">
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">Informations du Dispositif</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard title="Device ID" value={meta.device_id} />
        <MetricCard title="Firmware Version" value={meta.firmware_version} />
        <MetricCard title="Config Profile" value={meta.config_profile} />
        <MetricCard title="Temperature" value={meta.temperature_c.toFixed(1)} unit="°C" />
        <MetricCard title="Humidity" value={meta.humidity_percent.toFixed(1)} unit="%" />
      </div>
    </Card>
  </div>
);

// ============================================================================
// Utility Components
// ============================================================================

const ScoreBar: React.FC<{ title: string; score: number; negative?: boolean }> = ({ title, score, negative }) => {
  const percentage = score * 100;
  const color = negative ? 'bg-red-500' : percentage >= 75 ? 'bg-green-500' : percentage >= 50 ? 'bg-yellow-500' : 'bg-red-500';

  return (
    <div>
      <div className="text-sm text-gray-500 mb-1">{title}</div>
      <div className="bg-gray-200 rounded-full h-6 overflow-hidden">
        <div
          className={`${color} h-full flex items-center justify-center text-white text-xs font-bold`}
          style={{ width: `${percentage}%` }}
        >
          {percentage.toFixed(0)}%
        </div>
      </div>
    </div>
  );
};

const ChannelBar: React.FC<{ name: string; value: number; color: string }> = ({ name, value, color }) => {
  const colors: Record<string, string> = {
    violet: 'bg-violet-500',
    indigo: 'bg-indigo-500',
    blue: 'bg-blue-500',
    cyan: 'bg-cyan-500',
    green: 'bg-green-500',
    yellow: 'bg-yellow-500',
    orange: 'bg-orange-500',
    red: 'bg-red-500',
    gray: 'bg-gray-500',
  };

  const maxValue = 65535; // AS7341 max count
  const percentage = (value / maxValue) * 100;

  return (
    <div>
      <div className="text-xs text-gray-500 mb-1">{name}</div>
      <div className="bg-gray-200 rounded h-4 overflow-hidden">
        <div className={`${colors[color]} h-full`} style={{ width: `${percentage}%` }} />
      </div>
      <div className="text-xs text-gray-600 mt-1">{value}</div>
    </div>
  );
};

const MatrixVisualization: React.FC<{ title: string; matrix: number[][]; colorScheme: string }> = ({
  title,
  matrix,
  colorScheme,
}) => {
  if (!matrix || matrix.length !== 8 || matrix[0].length !== 8) {
    return null;
  }

  const maxValue = Math.max(...matrix.flat());
  const minValue = Math.min(...matrix.flat());

  const getColor = (value: number) => {
    const normalized = (value - minValue) / (maxValue - minValue);
    const intensity = Math.floor(normalized * 255);

    switch (colorScheme) {
      case 'blue':
        return `rgb(${255 - intensity}, ${255 - intensity}, 255)`;
      case 'green':
        return `rgb(${255 - intensity}, 255, ${255 - intensity})`;
      case 'purple':
        return `rgb(${255 - intensity / 2}, ${255 - intensity}, 255)`;
      default:
        return `rgb(${intensity}, ${intensity}, ${intensity})`;
    }
  };

  return (
    <div>
      <div className="text-sm font-semibold mb-2">{title}</div>
      <div className="grid grid-cols-8 gap-px border border-gray-300">
        {matrix.map((row, i) =>
          row.map((value, j) => (
            <div
              key={`${i}-${j}`}
              className="aspect-square flex items-center justify-center text-xs font-mono"
              style={{ backgroundColor: getColor(value) }}
              title={`[${i},${j}]: ${value.toFixed(1)}`}
            >
              {value.toFixed(0)}
            </div>
          ))
        )}
      </div>
      <div className="text-xs text-gray-500 mt-1 flex justify-between">
        <span>Min: {minValue.toFixed(1)}</span>
        <span>Max: {maxValue.toFixed(1)}</span>
      </div>
    </div>
  );
};

export default SensorDataViewer;
