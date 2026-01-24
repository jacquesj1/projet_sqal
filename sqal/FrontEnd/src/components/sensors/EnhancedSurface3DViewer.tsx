"use client"
import { Canvas, useThree } from "@react-three/fiber"
import { OrbitControls, PerspectiveCamera, Html } from "@react-three/drei"
import { useRef, useMemo, useState, useEffect } from "react"
import * as THREE from 'three'
import { Button } from "@components/ui/button"
import { Slider } from "@components/ui/slider"
import { Card, CardContent, CardHeader, CardTitle } from "@components/ui/card"
import { Eye, Layers, Grid3x3, Camera, RotateCcw } from "lucide-react"

type Props = {
  matrix: number[][];
  defects?: Array<{x: number, y: number, type: string}>;
  reflectance_matrix?: number[][];
  amplitude_matrix?: number[][];
  heightScale?: number;
  width?: number;
  height?: number;
}

type OverlayMode = 'height' | 'reflectance' | 'amplitude' | 'defects';
type ViewPreset = 'perspective' | 'top' | 'front' | 'side';

function CameraController({ preset, onComplete }: { preset: ViewPreset; onComplete: () => void }) {
  const { camera } = useThree();

  useEffect(() => {
    const positions = {
      perspective: { position: [15, 15, 15], target: [0, 0, 0] },
      top: { position: [0, 20, 0], target: [0, 0, 0] },
      front: { position: [0, 0, 20], target: [0, 0, 0] },
      side: { position: [20, 0, 0], target: [0, 0, 0] },
    };

    const { position, target } = positions[preset];
    camera.position.set(...position as [number, number, number]);
    camera.lookAt(...target as [number, number, number]);
    camera.updateProjectionMatrix();

    setTimeout(onComplete, 100);
  }, [preset, camera, onComplete]);

  return null;
}

function SurfaceMesh({
  matrix,
  heightScale = 0.5,
  defects = [],
  reflectance_matrix,
  amplitude_matrix,
  showWireframe = false,
  overlayMode = 'height'
}: Props & { showWireframe?: boolean; overlayMode?: OverlayMode }) {
  const size = matrix.length;
  const meshRef = useRef<THREE.Mesh>(null);

  const PHYSICAL_PIXEL_SIZE_MM = 6.25;
  const cellSize = PHYSICAL_PIXEL_SIZE_MM;
  const baseSize = size * PHYSICAL_PIXEL_SIZE_MM;

  const { minValue, maxValue } = useMemo(() => {
    const flatValues = matrix.flat().filter(v => v > 0);
    return {
      minValue: Math.min(...flatValues),
      maxValue: Math.max(...flatValues),
    };
  }, [matrix]);

  const geometry = useMemo(() => {
    const geom = new THREE.PlaneGeometry(
      baseSize,
      baseSize,
      size - 1,
      size - 1
    );

    const positions = geom.attributes.position.array as Float32Array;

    for (let i = 0; i < size; i++) {
      for (let j = 0; j < size; j++) {
        const idx = (i * size + j) * 3;
        const height = (matrix[i][j] - minValue) * heightScale;
        positions[idx + 2] = height;
      }}

    geom.computeVertexNormals();
    return geom;
  }, [matrix, size, baseSize, heightScale, minValue]);

  // Color mapping based on overlay mode
  const colors = useMemo(() => {
    const colorArray = new Float32Array(size * size * 3);

    for (let i = 0; i < size; i++) {
      for (let j = 0; j < size; j++) {
        const idx = (i * size + j) * 3;
        let r, g, b;

        switch (overlayMode) {
          case 'reflectance':
            if (reflectance_matrix) {
              const val = reflectance_matrix[i][j] / 255;
              r = val;
              g = val * 0.7;
              b = 1 - val;
            } else {
              r = g = b = 0.5;
            }
            break;

          case 'amplitude':
            if (amplitude_matrix) {
              const val = amplitude_matrix[i][j] / 100;
              r = 1 - val;
              g = val;
              b = 0;
            } else {
              r = g = b = 0.5;
            }
            break;

          case 'defects':
            const hasDefect = defects.some(d => d.x === j && d.y === i);
            r = hasDefect ? 1 : 0.3;
            g = hasDefect ? 0 : 0.8;
            b = hasDefect ? 0 : 0.3;
            break;

          case 'height':
          default:
            const normalized = (matrix[i][j] - minValue) / (maxValue - minValue);
            r = normalized;
            g = 0.5;
            b = 1 - normalized;
        }

        colorArray[idx] = r;
        colorArray[idx + 1] = g;
        colorArray[idx + 2] = b;
      }
    }

    return colorArray;
  }, [matrix, reflectance_matrix, amplitude_matrix, defects, overlayMode, size, minValue, maxValue]);

  useEffect(() => {
    if (meshRef.current) {
      const geom = meshRef.current.geometry;
      geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    }
  }, [colors]);

  return (
    <group>
      <mesh
        ref={meshRef}
        geometry={geometry}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0, 0]}
      >
        <meshStandardMaterial
          vertexColors
          wireframe={showWireframe}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Defect markers */}
      {overlayMode === 'defects' && defects.map((defect, idx) => {
        const x = (defect.x - size / 2) * cellSize;
        const y = (defect.y - size / 2) * cellSize;
        const height = (matrix[defect.y]?.[defect.x] || 0 - minValue) * heightScale;

        return (
          <group key={idx} position={[x, height + 2, -y]}>
            <mesh>
              <sphereGeometry args={[1, 16, 16]} />
              <meshBasicMaterial color="red" />
            </mesh>
            <Html distanceFactor={10}>
              <div className="bg-red-600 text-white px-2 py-1 rounded text-xs whitespace-nowrap">
                {defect.type}
              </div>
            </Html>
          </group>
        );
      })}

      {/* Grid helper */}
      <gridHelper args={[baseSize, size, 0x888888, 0xcccccc]} />
      <axesHelper args={[baseSize / 2]} />
    </group>
  );
}

export default function EnhancedSurface3DViewer({
  matrix,
  defects = [],
  reflectance_matrix,
  amplitude_matrix,
  heightScale: initialHeightScale = 0.5,
  width = 800,
  height = 600
}: Props) {
  const [showWireframe, setShowWireframe] = useState(false);
  const [autoRotate, setAutoRotate] = useState(false);
  const [heightScale, setHeightScale] = useState(initialHeightScale);
  const [overlayMode, setOverlayMode] = useState<OverlayMode>('height');
  const [viewPreset, setViewPreset] = useState<ViewPreset>('perspective');
  const [cameraKey, setCameraKey] = useState(0);

  const handleViewChange = (preset: ViewPreset) => {
    setViewPreset(preset);
    setCameraKey(prev => prev + 1);
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <Grid3x3 className="h-4 w-4" />
          Surface 3D Interactive
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Controls Row 1: View Presets */}
        <div className="flex gap-2 items-center">
          <span className="text-xs font-medium">Vues:</span>
          <Button
            size="sm"
            variant={viewPreset === 'perspective' ? 'default' : 'outline'}
            onClick={() => handleViewChange('perspective')}
          >
            <Camera className="h-3 w-3 mr-1" />
            Perspective
          </Button>
          <Button
            size="sm"
            variant={viewPreset === 'top' ? 'default' : 'outline'}
            onClick={() => handleViewChange('top')}
          >
            <Eye className="h-3 w-3 mr-1" />
            Dessus
          </Button>
          <Button
            size="sm"
            variant={viewPreset === 'front' ? 'default' : 'outline'}
            onClick={() => handleViewChange('front')}
          >
            Face
          </Button>
          <Button
            size="sm"
            variant={viewPreset === 'side' ? 'default' : 'outline'}
            onClick={() => handleViewChange('side')}
          >
            Côté
          </Button>
        </div>

        {/* Controls Row 2: Overlay Mode */}
        <div className="flex gap-2 items-center">
          <span className="text-xs font-medium">Données:</span>
          <Button
            size="sm"
            variant={overlayMode === 'height' ? 'default' : 'outline'}
            onClick={() => setOverlayMode('height')}
          >
            Hauteur
          </Button>
          <Button
            size="sm"
            variant={overlayMode === 'reflectance' ? 'default' : 'outline'}
            onClick={() => setOverlayMode('reflectance')}
            disabled={!reflectance_matrix}
          >
            Réflectance
          </Button>
          <Button
            size="sm"
            variant={overlayMode === 'amplitude' ? 'default' : 'outline'}
            onClick={() => setOverlayMode('amplitude')}
            disabled={!amplitude_matrix}
          >
            Amplitude
          </Button>
          <Button
            size="sm"
            variant={overlayMode === 'defects' ? 'default' : 'outline'}
            onClick={() => setOverlayMode('defects')}
            disabled={!defects.length}
          >
            Défauts ({defects.length})
          </Button>
        </div>

        {/* Controls Row 3: Display Options */}
        <div className="flex gap-2 items-center">
          <Button
            size="sm"
            variant={showWireframe ? 'default' : 'outline'}
            onClick={() => setShowWireframe(!showWireframe)}
          >
            <Layers className="h-3 w-3 mr-1" />
            Wireframe
          </Button>
          <Button
            size="sm"
            variant={autoRotate ? 'default' : 'outline'}
            onClick={() => setAutoRotate(!autoRotate)}
          >
            <RotateCcw className="h-3 w-3 mr-1" />
            Auto-rotation
          </Button>
        </div>

        {/* Height Scale Slider */}
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium whitespace-nowrap">Échelle hauteur:</span>
          <Slider
            value={[heightScale]}
            onValueChange={(values) => setHeightScale(values[0])}
            min={0.1}
            max={2}
            step={0.1}
            className="flex-1"
          />
          <span className="text-xs text-muted-foreground">{heightScale.toFixed(1)}x</span>
        </div>

        {/* Legend */}
        <div className="text-xs bg-gray-50 p-2 rounded">
          <p className="font-semibold mb-1">Mode actif: {overlayMode === 'height' ? 'Hauteur' : overlayMode === 'reflectance' ? 'Réflectance IR' : overlayMode === 'amplitude' ? 'Amplitude Signal' : 'Défauts'}</p>
          <p className="text-muted-foreground">
            {overlayMode === 'height' && 'Bleu = bas, Rouge = haut'}
            {overlayMode === 'reflectance' && 'Bleu = faible réflectance, Rouge = haute réflectance'}
            {overlayMode === 'amplitude' && 'Rouge = faible amplitude, Vert = haute amplitude'}
            {overlayMode === 'defects' && 'Rouge = défaut détecté, Vert = zone saine'}
          </p>
        </div>

        {/* 3D Canvas */}
        <div style={{ width, height }} className="border rounded">
          <Canvas>
            <PerspectiveCamera makeDefault position={[15, 15, 15]} />
            {cameraKey > 0 && (
              <CameraController
                preset={viewPreset}
                onComplete={() => {}}
              />
            )}
            <OrbitControls
              enableDamping
              dampingFactor={0.05}
              autoRotate={autoRotate}
              autoRotateSpeed={1}
            />
            <ambientLight intensity={0.5} />
            <directionalLight position={[10, 10, 5]} intensity={1} />
            <SurfaceMesh
              matrix={matrix}
              defects={defects}
              reflectance_matrix={reflectance_matrix}
              amplitude_matrix={amplitude_matrix}
              heightScale={heightScale}
              showWireframe={showWireframe}
              overlayMode={overlayMode}
            />
          </Canvas>
        </div>
      </CardContent>
    </Card>
  );
}
