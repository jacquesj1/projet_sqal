// src/types/foieGras.ts
export interface Defect {
    x?: number;
    y?: number;
    type: string;
    position?: { x: number; y: number }; // Support for position format
    severity?: string; // Optional severity
  }
  
  export interface Stats {
    volume_mm3: number;
    avg_height_mm: number;
    surface_uniformity: number;
  }
  
  export interface FoieGrasReport {
    distances: number[][];
    quality_score: number;
    grade: string;
    stats: Stats;
    defects: Defect[];
  }