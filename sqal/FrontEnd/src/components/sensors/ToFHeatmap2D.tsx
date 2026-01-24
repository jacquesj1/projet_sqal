// ============================================================================
// ToF Heatmap 2D Component
// Visualisation 2D de la matrice ToF avec gradient de couleurs
// Inspiré de TopViewHeatmap.tsx (Poubelle)
// ============================================================================

import { useEffect, useRef, useMemo } from 'react';

interface ToFHeatmap2DProps {
  matrix: number[][];
  width?: number;
  height?: number;
}

export function ToFHeatmap2D({ 
  matrix, 
  width = 400, 
  height = 400 
}: ToFHeatmap2DProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Calculate min and max for color scaling
  const { minDist, maxDist } = useMemo(() => {
    const flatMatrix = matrix.flat().filter((val) => val > 0);
    if (flatMatrix.length === 0) return { minDist: 0, maxDist: 100 };
    
    return {
      minDist: Math.min(...flatMatrix),
      maxDist: Math.max(...flatMatrix)
    };
  }, [matrix]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = matrix.length;
    const cellSize = width / size;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Draw heatmap
    matrix.forEach((row, i) => {
      row.forEach((distance, j) => {
        // Calculate normalized value (0-1)
        const normalized = maxDist > minDist 
          ? (distance - minDist) / (maxDist - minDist) 
          : 0;
        
        // Color gradient: Blue (240°) for close, Red (0°) for far
        const hue = (1 - normalized) * 240;
        
        // Fill cell
        ctx.fillStyle = distance === 0 ? '#1e293b' : `hsl(${hue}, 70%, 50%)`;
        ctx.fillRect(
          j * cellSize, 
          i * cellSize, 
          cellSize - 2, 
          cellSize - 2
        );

        // Draw value text
        ctx.fillStyle = 'white';
        ctx.font = '12px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(
          distance > 0 ? distance.toFixed(0) : '-',
          j * cellSize + cellSize / 2,
          i * cellSize + cellSize / 2
        );
      });
    });
  }, [matrix, width, height, minDist, maxDist]);

  return (
    <div className="bg-slate-900 rounded-lg p-4">
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="mx-auto"
      />
      <div className="mt-4 flex justify-center gap-4 text-xs text-white">
        <div className="flex items-center gap-2">
          <div 
            className="w-4 h-4 rounded" 
            style={{ background: 'hsl(240, 70%, 50%)' }}
          />
          <span>Proche ({minDist.toFixed(0)} mm)</span>
        </div>
        <div className="flex items-center gap-2">
          <div 
            className="w-4 h-4 rounded" 
            style={{ background: 'hsl(0, 70%, 50%)' }}
          />
          <span>Loin ({maxDist.toFixed(0)} mm)</span>
        </div>
      </div>
    </div>
  );
}
