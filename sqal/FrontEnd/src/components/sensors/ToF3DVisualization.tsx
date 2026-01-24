// ============================================================================
// ToF 3D Visualization Component
// Visualisation 3D interactive de la matrice ToF avec Three.js
// Surface continue pour une meilleure représentation de la forme ellipsoïdale
// ============================================================================

import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera } from "@react-three/drei";
import * as THREE from "three";

interface ToF3DVisualizationProps {
  distanceMatrix: number[][];
  defects?: Array<{ pos: [number, number]; type: string; severity: number }>;
  avgHeight?: number;
  maxHeight?: number;
  minHeight?: number;
}

function SurfaceMesh({ 
  distanceMatrix, 
  defects = [], 
  maxHeight = 100, 
  minHeight = 0,
  heightScale = 0.5 
}: { 
  distanceMatrix: number[][], 
  defects: Array<{ pos: [number, number]; type: string; severity: number }>,
  maxHeight: number,
  minHeight: number,
  heightScale?: number
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const size = distanceMatrix.length;
  const cellSize = 1;

  // Rotation automatique lente
  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.rotation.z += 0.002;
    }
  });

  // Créer une map des défauts pour un accès rapide
  const defectMap = useMemo(() => {
    const map = new Map<string, { type: string; severity: number }>();
    defects.forEach(d => {
      if (d && d.pos && Array.isArray(d.pos) && d.pos.length >= 2) {
        map.set(`${d.pos[0]},${d.pos[1]}`, { type: d.type, severity: d.severity });
      }
    });
    return map;
  }, [defects]);

  // Normalisation des valeurs pour une meilleure visualisation
  // IMPORTANT: Le capteur ToF est au-dessus, donc on inverse :
  // - Grande distance = zone basse (loin du capteur) → Z négatif
  // - Petite distance = zone haute (proche du capteur) → Z positif
  const heightRange = maxHeight - minHeight;
  const normalizedMatrix = useMemo(() => {
    return distanceMatrix.map(row => 
      row.map(value => {
        // Inverser la normalisation : maxHeight devient 0, minHeight devient 1
        const normalized = heightRange > 0 ? (maxHeight - value) / heightRange : 0;
        return normalized * 10; // Échelle pour une meilleure visibilité
      })
    );
  }, [distanceMatrix, minHeight, maxHeight, heightRange]);

  // Création de la géométrie avec des sommets déformés
  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(
      size * cellSize, 
      size * cellSize, 
      size - 1, 
      size - 1
    );

    // Déformation des sommets selon la matrice normalisée (déjà inversée)
    const positions = geo.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const x = i % size;
      const y = Math.floor(i / size);
      if (x < size && y < size) {
        const height = (normalizedMatrix[y]?.[x] || 0) * heightScale;
        positions.setZ(i, height);
      }
    }
    
    // Mise à jour des normales pour un éclairage correct
    geo.computeVertexNormals();
    
    return geo;
  }, [normalizedMatrix, size, cellSize, heightScale]);

  // Création de la texture de couleur basée sur la hauteur
  const colorTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    
    if (ctx) {
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const defect = defectMap.get(`${y},${x}`);
          const normalized = normalizedMatrix[y]?.[x] || 0;
          const value = normalized / 10; // 0-1
          
          let color: string;
          if (defect) {
            color = '#ff3333'; // Rouge pour défauts
          } else if (value > 0.8) {
            color = '#33ff33'; // Vert pour zones hautes
          } else if (value > 0.6) {
            color = '#33ffaa'; // Vert-bleu
          } else if (value > 0.4) {
            color = '#33aaff'; // Bleu
          } else if (value > 0.2) {
            color = '#cccc55'; // Bleu-jaune
          } else {
            color = '#ff9933'; // Orange
          }
          
          ctx.fillStyle = color;
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  }, [normalizedMatrix, size, defectMap]);

  return (
    <>
      {/* Surface principale */}
      <mesh 
        ref={meshRef} 
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0, 0]}
        castShadow
        receiveShadow
      >
        <bufferGeometry attach="geometry" {...geometry} />
        <meshStandardMaterial 
          map={colorTexture}
          side={THREE.DoubleSide}
          wireframe={false}
          flatShading={false}
          metalness={0.3}
          roughness={0.7}
          emissiveIntensity={0.1}
        />
      </mesh>
      
      {/* Grille de repère */}
      <gridHelper 
        args={[size, size, '#444444', '#666666']} 
        position={[0, -0.2, 0]} 
      />
      
      {/* Axes de référence */}
      <axesHelper args={[size * 0.8]} />
      
      {/* Défauts comme sphères rouges */}
      {defects.map((defect, i) => {
        if (!defect.pos || !Array.isArray(defect.pos) || defect.pos.length < 2) {
          return null;
        }
        const [y, x] = defect.pos;
        const height = (normalizedMatrix[y]?.[x] || 0) * heightScale;
        
        return (
          <mesh
            key={i}
            position={[
              (x - size/2 + 0.5) * cellSize, 
              height + 0.3, 
              (y - size/2 + 0.5) * cellSize
            ]}
          >
            <sphereGeometry args={[0.2, 16, 16]} />
            <meshStandardMaterial 
              color="red" 
              emissive="red"
              emissiveIntensity={0.5}
            />
          </mesh>
        );
      })}
    </>
  );
}

export function ToF3DVisualization({ 
  distanceMatrix, 
  defects = [],
  avgHeight = 0,
  maxHeight = 100,
  minHeight = 0
}: ToF3DVisualizationProps) {
  if (!distanceMatrix || distanceMatrix.length === 0) {
    return (
      <div className="w-full h-64 flex items-center justify-center bg-muted rounded-lg">
        <p className="text-muted-foreground">Aucune donnée 3D disponible</p>
      </div>
    );
  }

  const size = distanceMatrix.length;
  const cameraPosition: [number, number, number] = [size * 1.2, size * 1.5, size * 1.2];

  return (
    <div className="w-full h-96 relative bg-gray-900 rounded-lg overflow-hidden">
      <Canvas shadows camera={{ position: cameraPosition, fov: 50 }}>
        <PerspectiveCamera
          makeDefault
          position={cameraPosition}
          fov={50}
          near={0.1}
          far={size * 10}
        />
        
        {/* Lumières améliorées */}
        <ambientLight intensity={0.4} />
        <directionalLight 
          position={[10, 20, 10]} 
          intensity={1.2} 
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
        />
        <pointLight position={[-10, -10, -10]} intensity={0.5} />
        <pointLight position={[10, 5, -10]} intensity={0.3} color="#ffffff" />

        {/* Surface ToF 3D */}
        <SurfaceMesh 
          distanceMatrix={distanceMatrix} 
          defects={defects}
          maxHeight={maxHeight}
          minHeight={minHeight}
          heightScale={0.5}
        />

        {/* Contrôles de caméra */}
        <OrbitControls 
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          minDistance={size * 0.5}
          maxDistance={size * 3}
          autoRotate={false}
          autoRotateSpeed={1.0}
        />
      </Canvas>

      {/* Légende et statistiques */}
      <div className="absolute top-2 left-2 bg-background/90 backdrop-blur-sm p-3 rounded-lg border text-xs space-y-1">
        <div className="font-semibold mb-2">Statistiques 3D</div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-green-500 rounded"></div>
          <span>Zones hautes (&gt;80%)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-cyan-500 rounded"></div>
          <span>Zones moyennes (40-80%)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-orange-500 rounded"></div>
          <span>Zones basses (&lt;40%)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-red-500 rounded"></div>
          <span>Défauts détectés ({defects.length})</span>
        </div>
        <div className="border-t pt-2 mt-2 space-y-0.5">
          <div>Moy: {avgHeight.toFixed(1)} mm</div>
          <div>Max: {maxHeight.toFixed(1)} mm</div>
          <div>Min: {minHeight.toFixed(1)} mm</div>
          <div>Plage: {(maxHeight - minHeight).toFixed(1)} mm</div>
        </div>
      </div>

      {/* Instructions */}
      <div className="absolute bottom-2 right-2 bg-background/90 backdrop-blur-sm p-2 rounded-lg border text-xs">
        <div className="font-semibold mb-1">Contrôles</div>
        <div>🖱️ Clic gauche: Rotation</div>
        <div>🖱️ Molette: Zoom</div>
        <div>🖱️ Clic droit: Déplacement</div>
      </div>
    </div>
  );
}
