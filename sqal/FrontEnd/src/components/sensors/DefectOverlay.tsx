// In DefectOverlay.tsx
"use client"
import TopViewHeatmap from "./TopViewHeatmap";
import type { Defect } from "@/types/foieGras";

type Props = {
  matrix: number[][];
  defects: Defect[];
}

export default function DefectOverlay({ matrix, defects }: Props) {
  return (
    <div className="relative w-full h-full">
      <TopViewHeatmap matrix={matrix} />
      {defects.map((defect, index) => {
        // Support both direct x/y and position.x/position.y
        const x = defect.x ?? defect.position?.x ?? 0;
        const y = defect.y ?? defect.position?.y ?? 0;
        
        return (
          <div 
            key={index}
            className="absolute text-red-600 font-bold text-2xl pointer-events-none"
            style={{
              left: `${(x / (matrix[0]?.length - 1)) * 100}%`,
              top: `${(y / (matrix.length - 1)) * 100}%`,
              transform: "translate(-50%, -50%)",
            }}
            title={`${defect.type} (${x},${y})`}
          >
            ✕
          </div>
        );
      })}
    </div>
  );
}