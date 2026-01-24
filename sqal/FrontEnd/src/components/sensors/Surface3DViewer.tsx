"use client"
import { Canvas } from "@react-three/fiber"
import { OrbitControls, PerspectiveCamera } from "@react-three/drei"
import { useRef, useMemo, useState } from "react"
import * as THREE from 'three'
import { Button } from "@components/ui/button"
import { Slider } from "@components/ui/slider"

type Props = {
  matrix: number[][];
  defects?: Array<{x: number, y: number, type: string}>;
  heightScale?: number;
  width?: number;
  height?: number;
}

function SurfaceMesh({ matrix, heightScale = 0.5, defects = [], showWireframe = false }: Props & { showWireframe?: boolean }) {
  const size = matrix.length;
  const meshRef = useRef<THREE.Mesh>(null);

  // DIMENSIONS PHYSIQUES RÉELLES (pour foie gras typique)
  // Matrix 8x8 couvre environ 200mm × 100mm (selon CLAUDE.md)
  // Chaque pixel = 6.25mm en réalité
  const PHYSICAL_PIXEL_SIZE_MM = 6.25; // 200mm / 32 pixels (résolution max)
  const PHYSICAL_BASE_WIDTH_MM = size * PHYSICAL_PIXEL_SIZE_MM;  // ~50mm pour 8x8

  // Calcul des valeurs min/max pour normalisation intelligente
  const { minValue, maxValue } = useMemo(() => {
    const flatValues = matrix.flat().filter(v => v > 0);
    const min = Math.min(...flatValues);
    const max = Math.max(...flatValues);
    return {
      minValue: min,
      maxValue: max,
    };
  }, [matrix]);

  // CALCUL DU RATIO ORTHONORMÉ
  // On veut que 1 unité Three.js = 1mm physique
  // Donc si la base fait 50mm × 50mm, on utilise cellSize = 50/8 = 6.25
  const cellSize = PHYSICAL_PIXEL_SIZE_MM;
  const baseSize = PHYSICAL_BASE_WIDTH_MM;

  // Pour la hauteur (Z), on utilise directement les valeurs en mm
  // heightScale permet toujours d'amplifier visuellement si nécessaire
  // mais par défaut, 1 unité Z = 1mm réel

  // Normalisation: centrer les données autour de 0 pour meilleure visualisation
  // Mais conserver l'échelle RÉELLE en mm
  const normalizedMatrix = useMemo(() => {
    const mean = (minValue + maxValue) / 2;
    return matrix.map(row =>
      row.map(value => {
        if (value === 0) return 0;
        // Centrer autour de la moyenne, garder échelle réelle
        return (value - mean);
      })
    );
  }, [matrix, minValue, maxValue]);

  // Création de la géométrie avec plus de subdivisions pour plus de détails
  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(
      size * cellSize,
      size * cellSize,
      size - 1,
      size - 1
    );

    // Déformation des sommets selon la matrice normalisée
    const positions = geo.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const x = i % size;
      const y = Math.floor(i / size);
      if (x < size && y < size) {
        positions.setZ(i, (normalizedMatrix[y]?.[x] || 0) * heightScale);
      }
    }

    // Mise à jour des normales pour un éclairage correct
    geo.computeVertexNormals();

    return geo;
  }, [normalizedMatrix, heightScale, size, cellSize]);

  // Création d'une colormap par hauteur (vert → jaune → rouge)
  const vertexColors = useMemo(() => {
    const colors = new Float32Array(geometry.attributes.position.count * 3);
    const positions = geometry.attributes.position;

    for (let i = 0; i < positions.count; i++) {
      const z = positions.getZ(i);
      const normalizedHeight = (z / heightScale - minValue) / (maxValue - minValue);

      // Gradient: vert (bas) → jaune (moyen) → rouge (haut)
      let r, g, b;
      if (normalizedHeight < 0.5) {
        // Vert → Jaune
        const t = normalizedHeight * 2;
        r = t;
        g = 1.0;
        b = 0.0;
      } else {
        // Jaune → Rouge
        const t = (normalizedHeight - 0.5) * 2;
        r = 1.0;
        g = 1.0 - t;
        b = 0.0;
      }

      colors[i * 3] = r;
      colors[i * 3 + 1] = g;
      colors[i * 3 + 2] = b;
    }

    return colors;
  }, [geometry, heightScale, minValue, maxValue]);

  // Ajouter l'attribut de couleur à la géométrie
  useMemo(() => {
    geometry.setAttribute('color', new THREE.BufferAttribute(vertexColors, 3));
  }, [geometry, vertexColors]);

  return (
    <>
      <mesh
        ref={meshRef}
        rotation={[Math.PI / 2, 0, 0]}
        position={[0, 0, 0]}
      >
        <bufferGeometry attach="geometry" {...geometry} />
        <meshStandardMaterial
          vertexColors={true}
          side={THREE.DoubleSide}
          wireframe={showWireframe}
          flatShading={false}
          metalness={0.3}
          roughness={0.6}
        />
      </mesh>

      {/* Grille de repère améliorée - ÉCHELLE PHYSIQUE */}
      <gridHelper
        args={[baseSize * 1.2, size, '#333333', '#555555']}
        position={[0, -0.5, 0]}
      />

      {/* Axes de référence - ÉCHELLE PHYSIQUE */}
      <axesHelper args={[baseSize * 0.6]} />

      {/* Défauts avec marqueurs visuels améliorés */}
      {defects.map((defect, i) => (
        <group key={i}>
          <mesh
            position={[
              (defect.x - size/2 + 0.5) * cellSize,
              (normalizedMatrix[defect.y]?.[defect.x] || 0) * heightScale + 0.5,
              (defect.y - size/2 + 0.5) * cellSize
            ]}
          >
            <sphereGeometry args={[0.4, 16, 16]} />
            <meshStandardMaterial
              color="#ff0000"
              emissive="#ff0000"
              emissiveIntensity={0.5}
            />
          </mesh>
          {/* Marqueur vertical pour défaut */}
          <mesh
            position={[
              (defect.x - size/2 + 0.5) * cellSize,
              (normalizedMatrix[defect.y]?.[defect.x] || 0) * heightScale / 2,
              (defect.y - size/2 + 0.5) * cellSize
            ]}
          >
            <cylinderGeometry args={[0.05, 0.05, (normalizedMatrix[defect.y]?.[defect.x] || 0) * heightScale + 0.5]} />
            <meshStandardMaterial
              color="#ff0000"
              transparent
              opacity={0.5}
            />
          </mesh>
        </group>
      ))}
    </>
  );
}

export default function Surface3DViewer({ matrix, defects = [], heightScale = 1 }: Props) {
  const size = matrix.length;
  const cameraRef = useRef<THREE.PerspectiveCamera>(null);
  const [showWireframe, setShowWireframe] = useState(false);
  const [localHeightScale, setLocalHeightScale] = useState(heightScale);
  const [autoRotate, setAutoRotate] = useState(false);

  console.log("Surface3DViewer - Matrix size:", size, "x", size);

  // DIMENSIONS PHYSIQUES pour caméra (cohérentes avec SurfaceMesh)
  const PHYSICAL_PIXEL_SIZE_MM = 6.25;
  const baseSize = size * PHYSICAL_PIXEL_SIZE_MM; // Ex: 8 × 6.25 = 50mm

  // Position caméra optimisée pour vue de 3/4 depuis le dessus
  // Distance basée sur taille physique réelle, pas sur taille matrice
  const cameraPosition: [number, number, number] = [baseSize * 1.2, baseSize * 1.5, baseSize * 1.2];

  return (
    <div className="w-full space-y-2">
      {/* Contrôles interactifs */}
      <div className="flex flex-wrap gap-2 items-center bg-gray-800 p-3 rounded-lg">
        <Button
          variant={showWireframe ? "default" : "outline"}
          size="sm"
          onClick={() => setShowWireframe(!showWireframe)}
        >
          {showWireframe ? "Mode Plein" : "Mode Wireframe"}
        </Button>
        <Button
          variant={autoRotate ? "default" : "outline"}
          size="sm"
          onClick={() => setAutoRotate(!autoRotate)}
        >
          {autoRotate ? "Arrêter Rotation" : "Auto-Rotation"}
        </Button>
        <div className="flex items-center gap-2 ml-4">
          <span className="text-sm text-gray-300">Amplification hauteur:</span>
          <Slider
            value={[localHeightScale]}
            onValueChange={(value) => setLocalHeightScale(value[0])}
            min={0.1}
            max={3}
            step={0.1}
            className="w-32"
          />
          <span className="text-sm text-gray-400 min-w-[40px]">{localHeightScale.toFixed(1)}x</span>
        </div>
        <div className="ml-auto text-xs text-gray-400">
          📏 Échelle orthonormée (1:1:1) | 🟢 Bas → 🟡 Moyen → 🔴 Haut
        </div>
      </div>

      {/* Canvas 3D */}
      <div className="w-full h-[600px] bg-gray-900 rounded-lg overflow-hidden border-2 border-gray-700">
        <Canvas shadows camera={{ position: cameraPosition, fov: 50 }}>
          <PerspectiveCamera
            makeDefault
            position={cameraPosition}
            fov={50}
            near={0.1}
            far={size * 10}
            ref={cameraRef}
          />

          {/* Éclairage amélioré multi-sources */}
          <ambientLight intensity={0.5} />
          <directionalLight
            position={[10, 15, 10]}
            intensity={1.2}
            castShadow
            shadow-mapSize-width={2048}
            shadow-mapSize-height={2048}
          />
          <directionalLight
            position={[-10, 10, -10]}
            intensity={0.6}
          />
          <pointLight position={[0, 10, 0]} intensity={0.5} />
          <pointLight position={[size, 5, size]} intensity={0.3} color="#ffffff" />

          <SurfaceMesh
            matrix={matrix}
            defects={defects}
            heightScale={localHeightScale}
            showWireframe={showWireframe}
          />

          <OrbitControls
            enablePan={true}
            enableZoom={true}
            enableRotate={true}
            minDistance={baseSize * 0.5}
            maxDistance={baseSize * 4}
            autoRotate={autoRotate}
            autoRotateSpeed={1.5}
            target={[0, 0, 0]}
          />
        </Canvas>
      </div>

      {/* Légende */}
      <div className="bg-gray-800 p-2 rounded text-xs text-gray-400 flex justify-between items-center">
        <div>
          <span className="font-semibold">Contrôles:</span> Clic gauche = Rotation | Molette = Zoom | Clic droit = Panoramique
        </div>
        <div className="flex gap-4">
          <span>Matrice: {size}×{size} pixels</span>
          <span>Base: ~{baseSize.toFixed(0)}mm × {baseSize.toFixed(0)}mm</span>
          <span className="text-green-400 font-semibold">Échelle 1:1:1 (orthonormée)</span>
        </div>
      </div>
    </div>
  );
}