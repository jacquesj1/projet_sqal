// ============================================================================
// Advanced Surface 3D Viewer - Enhanced with bins analysis, defects, and realistic view
// ============================================================================

import React, { useState, useRef, useMemo, useCallback } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera, Grid, Html } from "@react-three/drei";
// Card components not used in this file - removed to fix TS6192
import { Button } from "@components/ui/button";
import { Badge } from "@components/ui/badge";
import { Slider } from "@components/ui/slider";
import * as THREE from "three";
import {
  Camera,
  RotateCw,
  ZoomIn,
  ZoomOut,
  Download,
  Eye,
  AlertTriangle,
  Activity,
  Layers,
} from "lucide-react";

type ViewPreset = "top" | "perspective" | "front" | "side";
type OverlayMode = "height" | "reflectance" | "amplitude" | "defects" | "bins_quality" | "roughness" | "texture" | "density" | "peak_bins";

// Custom zoom-to-cursor handler component
function ZoomToCursorHandler({
  meshRef,
  controlsRef,
  enabled = true
}: {
  meshRef: React.RefObject<THREE.Mesh>;
  controlsRef: React.RefObject<any>;
  enabled?: boolean
}) {
  const { camera, raycaster, gl } = useThree();

  const handleWheel = useCallback(
    (event: WheelEvent) => {
      if (!enabled || !meshRef.current || !controlsRef.current) return;

      // Get mouse position in normalized device coordinates (-1 to +1)
      const rect = gl.domElement.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1
      );

      // Raycaster to find intersection with mesh
      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObject(meshRef.current, true);

      if (intersects.length > 0) {
        const intersectionPoint = intersects[0].point;

        // Smoothly interpolate the target to the intersection point
        // Using lerp with factor 0.1 for smooth transition
        const currentTarget = controlsRef.current.target.clone();
        const lerpFactor = 0.1; // Lower = smoother transition
        const lerpedTarget = currentTarget.lerp(intersectionPoint, lerpFactor);

        controlsRef.current.target.copy(lerpedTarget);
        controlsRef.current.update();
      }
    },
    [enabled, camera, raycaster, gl, meshRef, controlsRef]
  );

  // Attach wheel event listener with lower priority to let default zoom work first
  React.useEffect(() => {
    const domElement = gl.domElement;
    if (enabled) {
      // Use capture phase to run after OrbitControls default handler
      domElement.addEventListener("wheel", handleWheel, { capture: false, passive: true });
    }
    return () => {
      domElement.removeEventListener("wheel", handleWheel);
    };
  }, [handleWheel, enabled, gl]);

  return null;
}

interface Defect {
  x: number;
  y: number;
  type: string;
  severity?: number;
}

interface BinsMetrics {
  density_score?: number;
  signal_quality?: number;
  surface_roughness?: number;
  texture_score?: number;
}

interface AdvancedSurface3DViewerProps {
  matrix: number[][];
  defects?: Defect[];
  reflectance_matrix?: number[][];
  amplitude_matrix?: number[][];
  bins_metrics?: BinsMetrics;
  peak_bin_map?: number[][];
  signal_quality_map?: number[][];
  surface_roughness_map?: number[][];
  texture_score_map?: number[][];
  density_score_map?: number[][];
  heightScale?: number;
  width?: number;
  height?: number;
}

// Enhanced surface mesh with multiple overlay modes
const SurfaceMesh = React.forwardRef<
  THREE.Mesh,
  AdvancedSurface3DViewerProps & { overlayMode?: OverlayMode; showWireframe?: boolean }
>(function SurfaceMesh({
  matrix,
  heightScale,
  defects = [],
  reflectance_matrix,
  amplitude_matrix,
  bins_metrics,
  peak_bin_map,
  signal_quality_map,
  surface_roughness_map,
  texture_score_map,
  density_score_map,
  overlayMode = "height",
  showWireframe = false,
}, forwardedRef) {
  const meshRef = (forwardedRef as React.RefObject<THREE.Mesh>) || useRef<THREE.Mesh>(null);
  const rows = matrix.length;
  const cols = matrix[0]?.length || 0;

  const normalize2D = useCallback((m: number[][], clampTo01 = true) => {
    const flat = m.flat().filter((v) => typeof v === "number" && !Number.isNaN(v));
    const minVal = flat.length ? Math.min(...flat) : 0;
    const maxVal = flat.length ? Math.max(...flat) : 0;
    const range = maxVal - minVal;
    const out = m.map((row) =>
      row.map((v) => {
        const raw = range > 0 ? (v - minVal) / range : 0;
        if (!clampTo01) return raw;
        return Math.max(0, Math.min(1, raw));
      })
    );
    return { out, minVal, maxVal };
  }, []);

  const normalize2DRobust = useCallback((m: number[][]) => {
    const flat = m
      .flat()
      .filter((v) => typeof v === "number" && !Number.isNaN(v))
      .slice()
      .sort((a, b) => a - b);

    if (!flat.length) return { out: m.map((row) => row.map(() => 0)), lo: 0, hi: 0 };

    const pick = (p: number) => {
      const idx = Math.min(flat.length - 1, Math.max(0, Math.floor(p * (flat.length - 1))));
      return flat[idx];
    };

    const lo = pick(0.05);
    const hi = pick(0.95);
    const range = hi - lo;

    const out = m.map((row) =>
      row.map((v) => {
        const raw = range > 0 ? (v - lo) / range : 0;
        return Math.max(0, Math.min(1, raw));
      })
    );

    return { out, lo, hi };
  }, []);

  // Prefer backend-provided 8x8 maps when available; fallback to a simple synthetic map
  const binsQualityMatrix = useMemo(() => {
    if (signal_quality_map && signal_quality_map.length > 0) {
      return normalize2D(signal_quality_map).out;
    }
    return matrix.map((row, i) =>
      row.map((_, j) => {
        const baseQuality = bins_metrics?.signal_quality ?? 0.8;
        const noise = (Math.sin(i * 0.5) * Math.cos(j * 0.5)) * 0.1;
        return Math.max(0, Math.min(1, baseQuality + noise));
      })
    );
  }, [matrix, bins_metrics, signal_quality_map, normalize2D]);

  // Prefer backend-provided roughness map when available
  const roughnessMatrix = useMemo(() => {
    if (surface_roughness_map && surface_roughness_map.length > 0) return normalize2D(surface_roughness_map).out;
    return matrix.map((row, i) =>
      row.map((val, j) => {
        const neighbors = [
          matrix[i - 1]?.[j] || val,
          matrix[i + 1]?.[j] || val,
          matrix[i]?.[j - 1] || val,
          matrix[i]?.[j + 1] || val,
        ];
        const variance = neighbors.reduce((sum, n) => sum + Math.abs(n - val), 0) / 4;
        return variance;
      })
    );
  }, [matrix, surface_roughness_map, normalize2D]);

  // Prefer backend-provided texture score map when available
  const textureMatrix = useMemo(() => {
    if (texture_score_map && texture_score_map.length > 0) return normalize2D(texture_score_map).out;
    return matrix.map((row, _i) =>
      row.map((_val, _j) => {
        const baseTexture = bins_metrics?.texture_score ?? 0.7;
        const noise = Math.random() * 0.2 - 0.1;
        return Math.max(0, Math.min(1, baseTexture + noise));
      })
    );
  }, [matrix, bins_metrics, texture_score_map, normalize2D]);

  // Prefer backend-provided density score map when available
  const densityMatrix = useMemo(() => {
    if (density_score_map && density_score_map.length > 0) return normalize2D(density_score_map).out;
    return matrix.map((row, i) =>
      row.map((_, j) => {
        const baseDensity = bins_metrics?.density_score ?? 0.75;
        const pattern = (Math.sin(i * 0.8) + Math.cos(j * 0.8)) * 0.1;
        return Math.max(0, Math.min(1, baseDensity + pattern));
      })
    );
  }, [matrix, bins_metrics, density_score_map, normalize2D]);

  const peakBinsMatrixNormalized = useMemo(() => {
    if (!peak_bin_map || peak_bin_map.length === 0) return null;
    const flat = peak_bin_map.flat().filter((v) => typeof v === "number" && !Number.isNaN(v));
    const maxVal = flat.length ? Math.max(...flat) : 0;
    const denom = maxVal > 0 ? maxVal : 1;
    return peak_bin_map.map((row) => row.map((v) => Math.max(0, Math.min(1, v / denom))));
  }, [peak_bin_map]);

  const amplitudeMatrixNormalized = useMemo(() => {
    if (!amplitude_matrix || amplitude_matrix.length === 0) return null;
    return normalize2DRobust(amplitude_matrix).out;
  }, [amplitude_matrix, normalize2DRobust]);

  // Geometry - with height normalization
  const geometry = useMemo(() => {
    // Find min/max for normalization
    const flatMatrix = matrix.flat();
    const minHeight = Math.min(...flatMatrix);
    const maxHeight = Math.max(...flatMatrix);
    const heightRange = maxHeight - minHeight;

    const geom = new THREE.PlaneGeometry(cols - 1, rows - 1, cols - 1, rows - 1);
    const positions = geom.attributes.position.array as Float32Array;

    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) {
        const idx = (i * cols + j) * 3;
        // Matrix is a distance-to-sensor (mm): smaller distance => higher surface
        const normalizedHeight = heightRange > 0 ? 1 - (matrix[i][j] - minHeight) / heightRange : 0;
        positions[idx + 2] = normalizedHeight * 2 * (heightScale || 1.0); // Scale to 0-2 units
      }
    }

    geom.attributes.position.needsUpdate = true;
    geom.computeVertexNormals();
    return geom;
  }, [matrix, heightScale, rows, cols]);

  // Color mapping based on overlay mode
  const colors = useMemo(() => {
    const colorArray = new Float32Array(rows * cols * 3);

    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) {
        const idx = (i * cols + j) * 3;
        let r = 0, g = 0, b = 0;

        switch (overlayMode) {
          case "height": {
            const minVal = Math.min(...matrix.flat());
            const maxVal = Math.max(...matrix.flat());
            const normalized = 1 - (matrix[i][j] - minVal) / (maxVal - minVal || 1);
            r = normalized;
            g = 0.2 + normalized * 0.3;
            b = 1 - normalized;
            break;
          }
          case "reflectance": {
            if (reflectance_matrix && reflectance_matrix.length > 0) {
              // Normalize reflectance (0-255 typically)
              const flatReflectance = reflectance_matrix.flat();
              const minRef = Math.min(...flatReflectance);
              const maxRef = Math.max(...flatReflectance);
              const val = reflectance_matrix[i]?.[j] || 0;
              const normalized = (maxRef > minRef) ? (val - minRef) / (maxRef - minRef) : 0;
              r = normalized;
              g = normalized * 0.5;
              b = 1 - normalized;
            } else {
              // Fallback to height if no reflectance data
              const minVal = Math.min(...matrix.flat());
              const maxVal = Math.max(...matrix.flat());
              const normalized = (matrix[i][j] - minVal) / (maxVal - minVal || 1);
              r = normalized * 0.5;
              g = 0.2;
              b = 0.8;
            }
            break;
          }
          case "amplitude": {
            if (amplitudeMatrixNormalized && amplitudeMatrixNormalized.length > 0) {
              const normalized = amplitudeMatrixNormalized[i]?.[j] ?? 0;
              r = 1 - normalized;
              g = normalized;
              b = 0;
            } else {
              // Fallback to height if no amplitude data
              const minVal = Math.min(...matrix.flat());
              const maxVal = Math.max(...matrix.flat());
              const normalized = (matrix[i][j] - minVal) / (maxVal - minVal || 1);
              r = 0.8;
              g = normalized * 0.5;
              b = 0.2;
            }
            break;
          }
          case "bins_quality": {
            const quality = binsQualityMatrix[i][j];
            r = 1 - quality;
            g = quality;
            b = 0.2;
            break;
          }
          case "roughness": {
            const rough = roughnessMatrix[i][j];
            r = rough;
            g = 0.5;
            b = 1 - rough;
            break;
          }
          case "texture": {
            const texture = textureMatrix[i][j];
            r = 0.8 * texture;
            g = 0.4 + texture * 0.6;
            b = 1 - texture * 0.5;
            break;
          }
          case "density": {
            const density = densityMatrix[i][j];
            r = 0.2;
            g = 0.6 * density;
            b = 1 - density * 0.3;
            break;
          }
          case "defects": {
            const hasDefect = defects.some(d => Math.abs(d.x - j) < 0.5 && Math.abs(d.y - i) < 0.5);
            r = hasDefect ? 1 : 0.2;
            g = hasDefect ? 0 : 0.8;
            b = hasDefect ? 0 : 0.2;
            break;
          }
          case "peak_bins": {
            if (peak_bin_map && peak_bin_map.length > 0) {
              const normalized = peakBinsMatrixNormalized?.[i]?.[j] ?? 0;
              // Rainbow spectrum: blue → green → yellow → red
              if (normalized < 0.33) {
                const t = normalized / 0.33;
                r = 0;
                g = t;
                b = 1 - t;
              } else if (normalized < 0.66) {
                const t = (normalized - 0.33) / 0.33;
                r = t;
                g = 1;
                b = 0;
              } else {
                const t = (normalized - 0.66) / 0.34;
                r = 1;
                g = 1 - t;
                b = 0;
              }
            } else {
              // Fallback: grayscale based on height
              const minVal = Math.min(...matrix.flat());
              const maxVal = Math.max(...matrix.flat());
              const normalized = (matrix[i][j] - minVal) / (maxVal - minVal || 1);
              r = normalized * 0.7;
              g = normalized * 0.7;
              b = normalized * 0.7;
            }
            break;
          }
        }

        colorArray[idx] = r;
        colorArray[idx + 1] = g;
        colorArray[idx + 2] = b;
      }
    }

    return colorArray;
  }, [matrix, overlayMode, reflectance_matrix, amplitude_matrix, defects, peak_bin_map, binsQualityMatrix, roughnessMatrix, textureMatrix, densityMatrix, peakBinsMatrixNormalized, rows, cols]);

  // Apply colors to geometry
  useMemo(() => {
    if (geometry) {
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    }
  }, [geometry, colors]);

  return (
    <group>
      <mesh ref={meshRef} geometry={geometry} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <meshStandardMaterial
          vertexColors
          side={THREE.DoubleSide}
          wireframe={showWireframe}
        />
      </mesh>

      {/* Enhanced Defect Markers */}
      {defects.map((defect, idx) => {
        const rawHeight = matrix[Math.floor(defect.y)]?.[Math.floor(defect.x)] || 0;
        const flatMatrix = matrix.flat();
        const minHeight = Math.min(...flatMatrix);
        const maxHeight = Math.max(...flatMatrix);
        const heightRange = maxHeight - minHeight;
        const normalizedHeight = heightRange > 0 ? 1 - (rawHeight - minHeight) / heightRange : 0;
        const scaledHeight = normalizedHeight * 2 * (heightScale || 1.0);

        // PlaneGeometry is centered around origin, so convert [0..cols-1] / [0..rows-1] to centered coordinates
        const cx = (cols - 1) / 2;
        const cy = (rows - 1) / 2;
        const x = defect.x - cx;
        const z = defect.y - cy;

        const severity = typeof defect.severity === 'number'
          ? defect.severity
          : defect.type === "cavity" ? 0.9 : defect.type === "foreign_body" ? 0.7 : 0.5;
        const color = severity > 0.8 ? "#ef4444" : severity > 0.6 ? "#f97316" : "#fbbf24";

        return (
          <group key={idx} position={[x, scaledHeight + 0.2, z]}>
            <mesh>
              <sphereGeometry args={[0.2, 16, 16]} />
              <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} />
            </mesh>
            <Html distanceFactor={10}>
              <div className="bg-white border-2 border-red-500 rounded px-2 py-1 text-xs font-bold whitespace-nowrap shadow-lg">
                ⚠️ {defect.type}
              </div>
            </Html>
          </group>
        );
      })}
    </group>
  );
});

export default function AdvancedSurface3DViewer({
  matrix,
  defects = [],
  reflectance_matrix,
  amplitude_matrix,
  bins_metrics,
  peak_bin_map,
  signal_quality_map,
  surface_roughness_map,
  texture_score_map,
  density_score_map,
  heightScale: initialHeightScale = 1.0,
  width = 800,
  height = 500,
}: AdvancedSurface3DViewerProps) {
  const [viewPreset, setViewPreset] = useState<ViewPreset>("top");
  const [overlayMode, setOverlayMode] = useState<OverlayMode>("height");
  const [heightScale, setHeightScale] = useState(initialHeightScale);
  const [showWireframe, setShowWireframe] = useState(false);
  const [autoRotate, setAutoRotate] = useState(false);
  const [zoomToCursor, setZoomToCursor] = useState(true); // Enable by default
  const [showDefects, setShowDefects] = useState(true); // Enable by default
  const controlsRef = useRef<any>(null);
  const surfaceMeshRef = useRef<THREE.Mesh>(null);

  const rows = matrix.length;
  const cols = matrix[0]?.length || 0;
  const sceneSize = Math.max(rows, cols);

  const handleViewChange = (preset: ViewPreset) => {
    setViewPreset(preset);

    // Manually move camera to preset position
    if (controlsRef.current) {
      const center = new THREE.Vector3(0, 0, 0);
      let targetPos: THREE.Vector3;

      switch (preset) {
        case "top":
          targetPos = new THREE.Vector3(0, 10, 0);
          break;
        case "perspective":
          targetPos = new THREE.Vector3(8, 7, 8);
          break;
        case "front":
          targetPos = new THREE.Vector3(0, 4, 12);
          break;
        case "side":
          targetPos = new THREE.Vector3(12, 4, 0);
          break;
        default:
          targetPos = new THREE.Vector3(8, 7, 8);
      }

      // Smoothly move camera
      controlsRef.current.object.position.copy(targetPos);
      controlsRef.current.target.copy(center);
      controlsRef.current.update();
    }
  };

  const overlayModes: { id: OverlayMode; label: string; icon: any; color: string }[] = [
    { id: "height", label: "Hauteur", icon: Layers, color: "blue" },
    { id: "reflectance", label: "Réflectance", icon: Eye, color: "purple" },
    { id: "amplitude", label: "Amplitude", icon: Activity, color: "orange" },
    { id: "defects", label: "Défauts", icon: AlertTriangle, color: "red" },
    { id: "bins_quality", label: "Qualité Signal", icon: Activity, color: "green" },
    { id: "peak_bins", label: "Peak Bins", icon: Activity, color: "pink" },
    { id: "roughness", label: "Rugosité", icon: Layers, color: "indigo" },
    { id: "texture", label: "Texture", icon: Eye, color: "cyan" },
    { id: "density", label: "Densité", icon: Layers, color: "teal" },
  ];

  return (
    <div className="w-full h-full flex flex-col gap-4">
      {/* Controls */}
      <div className="flex flex-wrap gap-2">
        {/* View Presets */}
        <div className="flex gap-1">
          <Button
            size="sm"
            variant={viewPreset === "top" ? "default" : "outline"}
            onClick={() => handleViewChange("top")}
          >
            <Camera className="h-4 w-4 mr-1" />
            Dessus
          </Button>
          <Button
            size="sm"
            variant={viewPreset === "perspective" ? "default" : "outline"}
            onClick={() => handleViewChange("perspective")}
          >
            Perspective
          </Button>
          <Button
            size="sm"
            variant={viewPreset === "front" ? "default" : "outline"}
            onClick={() => handleViewChange("front")}
          >
            Face
          </Button>
          <Button
            size="sm"
            variant={viewPreset === "side" ? "default" : "outline"}
            onClick={() => handleViewChange("side")}
          >
            Côté
          </Button>
        </div>

        {/* Additional Controls */}
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowWireframe(!showWireframe)}
        >
          Wireframe
        </Button>
        <Button
          size="sm"
          variant={showDefects ? "default" : "outline"}
          onClick={() => setShowDefects((v) => !v)}
          title="Afficher/masquer les marqueurs de défauts"
        >
          <AlertTriangle className="h-4 w-4 mr-1" />
          Défauts
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setAutoRotate(!autoRotate)}
        >
          <RotateCw className="h-4 w-4 mr-1" />
          {autoRotate ? "Stop" : "Rotation"}
        </Button>
        <Button
          size="sm"
          variant={zoomToCursor ? "default" : "outline"}
          onClick={() => setZoomToCursor(!zoomToCursor)}
          title="Zoomer vers le curseur (comme Fusion360)"
        >
          <ZoomIn className="h-4 w-4 mr-1" />
          Zoom Curseur
        </Button>
        <div className="flex gap-1">
          <Button size="sm" variant="outline" title="Zoomer (ou molette souris)">
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="outline" title="Dézoomer (ou molette souris)">
            <ZoomOut className="h-4 w-4" />
          </Button>
        </div>
        <Button size="sm" variant="outline">
          <Download className="h-4 w-4 mr-1" />
          Export
        </Button>
      </div>

      {/* Overlay Mode Selection */}
      <div className="flex flex-wrap gap-2">
        {overlayModes.map((mode) => (
          <Button
            key={mode.id}
            size="sm"
            variant={overlayMode === mode.id ? "default" : "outline"}
            onClick={() => setOverlayMode(mode.id)}
            className={overlayMode === mode.id ? `bg-${mode.color}-500` : ""}
          >
            <mode.icon className="h-3 w-3 mr-1" />
            {mode.label}
            {mode.id === "defects" && defects.length > 0 && (
              <Badge variant="destructive" className="ml-2">
                {defects.length}
              </Badge>
            )}
          </Button>
        ))}
      </div>

      {/* Height Scale Slider */}
      <div className="flex items-center gap-4">
        <span className="text-sm font-medium whitespace-nowrap">Échelle Hauteur:</span>
        <Slider
          value={[heightScale]}
          onValueChange={(vals) => setHeightScale(vals[0])}
          min={0.1}
          max={3.0}
          step={0.1}
          className="w-48"
        />
        <span className="text-sm text-muted-foreground">{heightScale.toFixed(1)}x</span>
      </div>

      {/* 3D Canvas */}
      <div className="relative" style={{ width: "100%", height: `${height}px` }}>
        <Canvas>
          <PerspectiveCamera makeDefault position={[8, 7, 8]} fov={50} />

          <ambientLight intensity={0.7} />
          <directionalLight position={[4, 4, 15]} intensity={1.2} castShadow />
          <pointLight position={[8, 8, 5]} intensity={0.4} />

          <SurfaceMesh
            ref={surfaceMeshRef}
            matrix={matrix}
            heightScale={heightScale}
            defects={showDefects ? defects : []}
            reflectance_matrix={reflectance_matrix}
            amplitude_matrix={amplitude_matrix}
            bins_metrics={bins_metrics}
            peak_bin_map={peak_bin_map}
            signal_quality_map={signal_quality_map}
            surface_roughness_map={surface_roughness_map}
            texture_score_map={texture_score_map}
            density_score_map={density_score_map}
            overlayMode={overlayMode}
            showWireframe={showWireframe}
          />

          {/* Zoom to cursor handler */}
          <ZoomToCursorHandler
            meshRef={surfaceMeshRef}
            controlsRef={controlsRef}
            enabled={zoomToCursor}
          />

          <Grid
            args={[Math.max(8, sceneSize), Math.max(8, sceneSize)]}
            position={[0, -0.02, 0]}
            rotation={[0, 0, 0]}
            cellColor="#9ca3af"
            sectionColor="#6b7280"
            fadeDistance={20}
            fadeStrength={1}
          />

          <OrbitControls
            ref={controlsRef}
            makeDefault
            enableDamping
            dampingFactor={0.05}
            autoRotate={autoRotate}
            autoRotateSpeed={1}
            enableZoom={true}
            zoomSpeed={1.0}
            minDistance={2}
            maxDistance={30}
            target={[0, 0, 0]}
            maxPolarAngle={Math.PI}
            minPolarAngle={0}
            mouseButtons={{
              LEFT: THREE.MOUSE.ROTATE,
              MIDDLE: THREE.MOUSE.DOLLY,
              RIGHT: THREE.MOUSE.PAN,
            }}
          />
        </Canvas>

        {/* Legend */}
        <div className="absolute top-4 right-4 bg-white/90 backdrop-blur p-3 rounded shadow-lg text-xs space-y-1">
          <p className="font-bold">{overlayModes.find(m => m.id === overlayMode)?.label}</p>
          {overlayMode === "height" && <p>🔵 Bas → 🔴 Haut</p>}
          {overlayMode === "reflectance" && (
            <>
              <p>🔵 Faible → 🔴 Élevée</p>
              {(!reflectance_matrix || reflectance_matrix.length === 0) && (
                <p className="text-orange-600 text-[10px]">⚠️ Données manquantes (fallback hauteur)</p>
              )}
            </>
          )}
          {overlayMode === "amplitude" && (
            <>
              <p>🔴 Faible → 🟢 Fort</p>
              {(!amplitude_matrix || amplitude_matrix.length === 0) && (
                <p className="text-orange-600 text-[10px]">⚠️ Données manquantes (fallback hauteur)</p>
              )}
            </>
          )}
          {overlayMode === "defects" && <p>🔴 Défaut • 🟢 Sain</p>}
          {overlayMode === "peak_bins" && (
            <>
              <p>🔵→🟢→🟡→🔴 Spectrum</p>
              <p className="text-[10px]">Bin 0-127 (distance)</p>
              {(!peak_bin_map || peak_bin_map.length === 0) && (
                <p className="text-orange-600 text-[10px]">⚠️ Données manquantes (fallback gris)</p>
              )}
            </>
          )}
          {overlayMode === "bins_quality" && (
            <>
              <p>🔴 Faible → 🟢 Bonne</p>
              {(!bins_metrics?.signal_quality) && (
                <p className="text-orange-600 text-[10px]">⚠️ Qualité calculée (simulée)</p>
              )}
            </>
          )}
          {overlayMode === "roughness" && <p>🔵 Lisse → 🔴 Rugueux</p>}
          {overlayMode === "texture" && (
            <>
              <p>🔵 Faible → 🟢 Riche</p>
              {(!bins_metrics?.texture_score) && (
                <p className="text-orange-600 text-[10px]">⚠️ Texture calculée (simulée)</p>
              )}
            </>
          )}
          {overlayMode === "density" && (
            <>
              <p>🟢 Dense → 🔵 Léger</p>
              {(!bins_metrics?.density_score) && (
                <p className="text-orange-600 text-[10px]">⚠️ Densité calculée (simulée)</p>
              )}
            </>
          )}
          {defects.length > 0 && (
            <p className="mt-2 pt-2 border-t">⚠️ {defects.length} défaut(s)</p>
          )}
        </div>
      </div>
    </div>
  );
}
