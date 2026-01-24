// ============================================================================
// Confusion Matrix Component
// Matrice de confusion pour évaluation des modèles IA
// ============================================================================

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@components/ui/card';

interface ConfusionMatrixProps {
  matrix: number[][];
  labels: string[];
  title?: string;
  description?: string;
}

export function ConfusionMatrix({
  matrix,
  labels,
  title = 'Matrice de Confusion',
  description,
}: ConfusionMatrixProps) {
  // Calculer les valeurs min/max pour la normalisation des couleurs
  const flatMatrix = matrix.flat();
  const maxValue = Math.max(...flatMatrix);
  const minValue = Math.min(...flatMatrix);

  // Fonction pour obtenir la couleur en fonction de la valeur
  const getColor = (value: number) => {
    const normalized = (value - minValue) / (maxValue - minValue || 1);
    const intensity = Math.floor(normalized * 255);
    return `rgb(${255 - intensity}, ${255 - intensity / 2}, 255)`;
  };

  // Fonction pour déterminer la couleur du texte
  const getTextColor = (value: number) => {
    const normalized = (value - minValue) / (maxValue - minValue || 1);
    return normalized > 0.5 ? 'text-white' : 'text-gray-900';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="p-2 border"></th>
                <th className="p-2 border text-center font-semibold" colSpan={labels.length}>
                  Prédiction
                </th>
              </tr>
              <tr>
                <th className="p-2 border"></th>
                {labels.map((label, index) => (
                  <th key={index} className="p-2 border text-center text-sm font-medium">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matrix.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {rowIndex === 0 && (
                    <th
                      className="p-2 border text-center font-semibold"
                      rowSpan={labels.length}
                      style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
                    >
                      Réel
                    </th>
                  )}
                  <th className="p-2 border text-center text-sm font-medium">
                    {labels[rowIndex]}
                  </th>
                  {row.map((value, colIndex) => (
                    <td
                      key={colIndex}
                      className={`p-4 border text-center font-mono font-semibold ${getTextColor(value)}`}
                      style={{ backgroundColor: getColor(value) }}
                    >
                      {value}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Légende */}
        <div className="mt-4 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <span>Faible</span>
          <div className="flex gap-1">
            {[0, 0.25, 0.5, 0.75, 1].map((val, idx) => (
              <div
                key={idx}
                className="w-8 h-4 border"
                style={{ backgroundColor: getColor(minValue + val * (maxValue - minValue)) }}
              />
            ))}
          </div>
          <span>Élevé</span>
        </div>
      </CardContent>
    </Card>
  );
}
