import React, { useEffect, useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Alert, AlertDescription } from '../ui/alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import {
  GitCompare,
  Plus,
  X,
  TrendingUp,
  TrendingDown,
  Minus,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';

// Types
interface SampleData {
  sample_id: string;
  timestamp: string;
  device_id: string;
  fusion: {
    final_score: number;
    final_grade: string;
  };
  vl53l8ch: {
    volume_mm3: number;
    avg_height_mm: number;
    quality_score: number;
  };
  as7341: {
    quality_score: number;
    freshness_index: number;
    fat_quality_index: number;
  };
}

interface SampleComparisonViewProps {
  className?: string;
  initialSampleIds?: string[];
}

// Grade colors
const GRADE_COLORS: Record<string, string> = {
  'A+': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  A: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  B: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  C: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  REJECT:
    'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

/**
 * SampleComparisonView - Professional side-by-side sample comparison
 *
 * Features:
 * - Compare up to 5 samples
 * - Visual metric comparison
 * - Trend indicators (better/worse/equal)
 * - Responsive table/cards layout
 * - Professional agro-food design
 */
export const SampleComparisonView: React.FC<SampleComparisonViewProps> = ({
  className = '',
  initialSampleIds = [],
}) => {
  // State
  const [sampleIds, setSampleIds] = useState<string[]>(initialSampleIds);
  const [samples, setSamples] = useState<SampleData[]>([]);
  const [loading, setLoading] = useState(false);
  const [newSampleId, setNewSampleId] = useState('');

  // Fetch samples
  const fetchComparison = async (ids: string[]) => {
    if (ids.length === 0) {
      setSamples([]);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(
        `/api/analysis/compare?sample_ids=${ids.join(',')}`
      );

      if (!response.ok) throw new Error('Échec de chargement');

      const data: SampleData[] = await response.json();
      setSamples(data);
    } catch (error) {
      toast.error('Impossible de charger les échantillons');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComparison(sampleIds);
  }, [sampleIds]);

  // Add sample
  const handleAddSample = () => {
    if (!newSampleId.trim()) {
      toast.error('Veuillez entrer un ID d\'échantillon');
      return;
    }

    if (sampleIds.includes(newSampleId)) {
      toast.error('Cet échantillon est déjà dans la comparaison');
      return;
    }

    if (sampleIds.length >= 5) {
      toast.error('Maximum 5 échantillons peuvent être comparés');
      return;
    }

    setSampleIds([...sampleIds, newSampleId]);
    setNewSampleId('');
  };

  // Remove sample
  const handleRemoveSample = (id: string) => {
    setSampleIds(sampleIds.filter((sId) => sId !== id));
  };

  // Calculate trend relative to first sample
  const getTrend = (currentValue: number, baseValue: number) => {
    const diff = ((currentValue - baseValue) / baseValue) * 100;

    if (Math.abs(diff) < 1) {
      return {
        icon: <Minus className="h-3 w-3" />,
        color: 'text-gray-500',
        text: 'Identique',
      };
    } else if (diff > 0) {
      return {
        icon: <TrendingUp className="h-3 w-3" />,
        color: 'text-green-600',
        text: `+${diff.toFixed(1)}%`,
      };
    } else {
      return {
        icon: <TrendingDown className="h-3 w-3" />,
        color: 'text-red-600',
        text: `${diff.toFixed(1)}%`,
      };
    }
  };

  // Render comparison table
  const renderComparisonTable = () => {
    if (samples.length === 0) return null;

    const baseSample = samples[0];

    return (
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[200px]">Métrique</TableHead>
              {samples.map((sample) => (
                <TableHead key={sample.sample_id} className="text-center">
                  <div className="space-y-1">
                    <div className="font-mono text-xs">{sample.sample_id}</div>
                    <Badge
                      className={GRADE_COLORS[sample.fusion.final_grade]}
                      variant="outline"
                    >
                      {sample.fusion.final_grade}
                    </Badge>
                  </div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {/* Score Final */}
            <TableRow>
              <TableCell className="font-medium">Score Qualité Final</TableCell>
              {samples.map((sample, idx) => {
                const trend =
                  idx > 0
                    ? getTrend(
                        sample.fusion.final_score,
                        baseSample.fusion.final_score
                      )
                    : null;

                return (
                  <TableCell key={sample.sample_id} className="text-center">
                    <div className="flex flex-col items-center gap-1">
                      <span className="font-semibold">
                        {sample.fusion.final_score.toFixed(3)}
                      </span>
                      {trend && (
                        <span
                          className={`flex items-center gap-1 text-xs ${trend.color}`}
                        >
                          {trend.icon}
                          {trend.text}
                        </span>
                      )}
                    </div>
                  </TableCell>
                );
              })}
            </TableRow>

            {/* Volume */}
            <TableRow>
              <TableCell className="font-medium">Volume (mm³)</TableCell>
              {samples.map((sample, idx) => {
                const trend =
                  idx > 0
                    ? getTrend(
                        sample.vl53l8ch.volume_mm3,
                        baseSample.vl53l8ch.volume_mm3
                      )
                    : null;

                return (
                  <TableCell key={sample.sample_id} className="text-center">
                    <div className="flex flex-col items-center gap-1">
                      <span>{sample.vl53l8ch.volume_mm3.toFixed(1)}</span>
                      {trend && (
                        <span
                          className={`flex items-center gap-1 text-xs ${trend.color}`}
                        >
                          {trend.icon}
                          {trend.text}
                        </span>
                      )}
                    </div>
                  </TableCell>
                );
              })}
            </TableRow>

            {/* Hauteur */}
            <TableRow>
              <TableCell className="font-medium">Hauteur Moy. (mm)</TableCell>
              {samples.map((sample, idx) => {
                const trend =
                  idx > 0
                    ? getTrend(
                        sample.vl53l8ch.avg_height_mm,
                        baseSample.vl53l8ch.avg_height_mm
                      )
                    : null;

                return (
                  <TableCell key={sample.sample_id} className="text-center">
                    <div className="flex flex-col items-center gap-1">
                      <span>{sample.vl53l8ch.avg_height_mm.toFixed(1)}</span>
                      {trend && (
                        <span
                          className={`flex items-center gap-1 text-xs ${trend.color}`}
                        >
                          {trend.icon}
                          {trend.text}
                        </span>
                      )}
                    </div>
                  </TableCell>
                );
              })}
            </TableRow>

            {/* VL53L8CH Score */}
            <TableRow>
              <TableCell className="font-medium">
                Score VL53L8CH (ToF)
              </TableCell>
              {samples.map((sample, idx) => {
                const trend =
                  idx > 0
                    ? getTrend(
                        sample.vl53l8ch.quality_score,
                        baseSample.vl53l8ch.quality_score
                      )
                    : null;

                return (
                  <TableCell key={sample.sample_id} className="text-center">
                    <div className="flex flex-col items-center gap-1">
                      <span>{sample.vl53l8ch.quality_score.toFixed(3)}</span>
                      {trend && (
                        <span
                          className={`flex items-center gap-1 text-xs ${trend.color}`}
                        >
                          {trend.icon}
                          {trend.text}
                        </span>
                      )}
                    </div>
                  </TableCell>
                );
              })}
            </TableRow>

            {/* AS7341 Score */}
            <TableRow>
              <TableCell className="font-medium">
                Score AS7341 (Spectral)
              </TableCell>
              {samples.map((sample, idx) => {
                const trend =
                  idx > 0
                    ? getTrend(
                        sample.as7341.quality_score,
                        baseSample.as7341.quality_score
                      )
                    : null;

                return (
                  <TableCell key={sample.sample_id} className="text-center">
                    <div className="flex flex-col items-center gap-1">
                      <span>{sample.as7341.quality_score.toFixed(3)}</span>
                      {trend && (
                        <span
                          className={`flex items-center gap-1 text-xs ${trend.color}`}
                        >
                          {trend.icon}
                          {trend.text}
                        </span>
                      )}
                    </div>
                  </TableCell>
                );
              })}
            </TableRow>

            {/* Indice Fraîcheur */}
            <TableRow>
              <TableCell className="font-medium">Indice Fraîcheur</TableCell>
              {samples.map((sample, idx) => {
                const trend =
                  idx > 0
                    ? getTrend(
                        sample.as7341.freshness_index,
                        baseSample.as7341.freshness_index
                      )
                    : null;

                return (
                  <TableCell key={sample.sample_id} className="text-center">
                    <div className="flex flex-col items-center gap-1">
                      <span>{sample.as7341.freshness_index.toFixed(3)}</span>
                      {trend && (
                        <span
                          className={`flex items-center gap-1 text-xs ${trend.color}`}
                        >
                          {trend.icon}
                          {trend.text}
                        </span>
                      )}
                    </div>
                  </TableCell>
                );
              })}
            </TableRow>

            {/* Qualité Gras */}
            <TableRow>
              <TableCell className="font-medium">Qualité Gras</TableCell>
              {samples.map((sample, idx) => {
                const trend =
                  idx > 0
                    ? getTrend(
                        sample.as7341.fat_quality_index,
                        baseSample.as7341.fat_quality_index
                      )
                    : null;

                return (
                  <TableCell key={sample.sample_id} className="text-center">
                    <div className="flex flex-col items-center gap-1">
                      <span>{sample.as7341.fat_quality_index.toFixed(3)}</span>
                      {trend && (
                        <span
                          className={`flex items-center gap-1 text-xs ${trend.color}`}
                        >
                          {trend.icon}
                          {trend.text}
                        </span>
                      )}
                    </div>
                  </TableCell>
                );
              })}
            </TableRow>

            {/* Timestamp */}
            <TableRow>
              <TableCell className="font-medium">Date & Heure</TableCell>
              {samples.map((sample) => (
                <TableCell key={sample.sample_id} className="text-center">
                  <span className="text-xs text-muted-foreground">
                    {new Date(sample.timestamp).toLocaleString('fr-FR')}
                  </span>
                </TableCell>
              ))}
            </TableRow>

            {/* Actions */}
            <TableRow>
              <TableCell className="font-medium">Actions</TableCell>
              {samples.map((sample) => (
                <TableCell key={sample.sample_id} className="text-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveSample(sample.sample_id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </TableCell>
              ))}
            </TableRow>
          </TableBody>
        </Table>
      </div>
    );
  };

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <GitCompare className="h-5 w-5 text-primary" />
              Comparaison d'Échantillons
            </CardTitle>
            <CardDescription className="mt-1">
              Comparer jusqu'à 5 échantillons côte à côte
            </CardDescription>
          </div>

          {/* Add Sample Input */}
          <div className="flex gap-2">
            <Input
              placeholder="ID échantillon"
              value={newSampleId}
              onChange={(e) => setNewSampleId(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleAddSample()}
              className="w-[200px]"
              disabled={sampleIds.length >= 5}
            />
            <Button
              onClick={handleAddSample}
              disabled={sampleIds.length >= 5}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Ajouter
            </Button>
          </div>
        </div>

        {/* Info */}
        {sampleIds.length >= 5 && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Maximum 5 échantillons. Retirez un échantillon pour en ajouter un
              autre.
            </AlertDescription>
          </Alert>
        )}
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="flex h-[400px] items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">
                Chargement de la comparaison...
              </p>
            </div>
          </div>
        ) : samples.length === 0 ? (
          <Alert>
            <GitCompare className="h-4 w-4" />
            <AlertDescription>
              Ajoutez des échantillons pour commencer la comparaison. Entrez
              l'ID d'un échantillon ci-dessus.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-4">
            {/* Legend */}
            <div className="flex items-center gap-4 rounded-lg border bg-muted/50 p-3 text-sm">
              <span className="font-medium">Légende:</span>
              <div className="flex items-center gap-1 text-green-600">
                <TrendingUp className="h-3 w-3" />
                <span>Amélioration</span>
              </div>
              <div className="flex items-center gap-1 text-red-600">
                <TrendingDown className="h-3 w-3" />
                <span>Dégradation</span>
              </div>
              <div className="flex items-center gap-1 text-gray-500">
                <Minus className="h-3 w-3" />
                <span>Identique</span>
              </div>
              <span className="ml-auto text-xs text-muted-foreground">
                % relatif au premier échantillon
              </span>
            </div>

            {/* Comparison Table */}
            {renderComparisonTable()}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
