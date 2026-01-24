"use client"
import { Canvas } from "@react-three/fiber"
import { OrbitControls, PerspectiveCamera } from "@react-three/drei"
import { useRef } from "react"
import * as THREE from 'three'

type Props = {
  matrix: number[][];
  defects?: Array<{x: number, y: number, type: string}>;
  heightScale?: number;
}

function SurfaceMesh({ matrix, heightScale = 0.5, defects = [] }: Props) {
  const size = matrix.length;
  const meshRef = useRef<THREE.Mesh>(null);
  const cellSize = 1;
  
  // Normalisation des valeurs pour une meilleure visualisation
  const normalizedMatrix = matrix.map(row => 
    row.map(value => (value - 19) * 2) // Ajustement pour accentuer les différences
  );
  
  // Création de la géométrie avec des sommets déformés
  const geometry = new THREE.PlaneGeometry(
    size * cellSize, 
    size * cellSize, 
    size - 1, 
    size - 1
  );

  // Déformation des sommets selon la matrice normalisée
  const positions = geometry.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    const x = i % size;
    const y = Math.floor(i / size);
    if (x < size && y < size) {
      positions.setZ(i, (normalizedMatrix[y]?.[x] || 0) * heightScale);
    }
  }
  
  // Mise à jour des normales pour un éclairage correct
  geometry.computeVertexNormals();

  return (
    <>
      <mesh 
        ref={meshRef} 
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0, 0]}
      >
        <bufferGeometry attach="geometry" {...geometry} />
        <meshStandardMaterial 
          color="#ff7e5f"
          side={THREE.DoubleSide}
          wireframe={false}
          flatShading={true}
          metalness={0.2}
          roughness={0.4}
          emissive="#ff7e5f"
          emissiveIntensity={0.2}
        />
      </mesh>
      
      {/* Grille de repère améliorée */}
      <gridHelper 
        args={[size, size, '#444444', '#666666']} 
        position={[0, -0.1, 0]} 
      />
      
      {/* Axes de référence avec légendes */}
      <axesHelper args={[size * 0.8]} />
      
      {/* Défauts */}
      {defects.map((defect, i) => (
        <mesh
          key={i}
          position={[
            (defect.x - size/2 + 0.5) * cellSize, 
            (matrix[defect.y]?.[defect.x] || 0) * heightScale + 0.1, 
            (defect.y - size/2 + 0.5) * cellSize
          ]}
        >
          <sphereGeometry args={[0.3, 16, 16]} />
          <meshStandardMaterial color="red" />
        </mesh>
      ))}
    </>
  );
}

export default function Surface3DViewer({ matrix, defects = [] }: Props) {
  const size = matrix.length;
  const cameraRef = useRef<THREE.PerspectiveCamera>(null);
  console.log(matrix)
  // Ajustement automatique de la caméra
  const cameraPosition: [number, number, number] = [size, size * 0.8, size];
  
  return (
    <div className="w-full h-[600px] bg-gray-900 rounded-lg overflow-hidden">
      <Canvas shadows camera={{ position: [10, 15, 15], fov: 50 }}>
        <PerspectiveCamera
          makeDefault
          position={cameraPosition}
          fov={50}
          near={0.1}
          far={size * 10}
          ref={cameraRef}
        />
        
        <ambientLight intensity={0.3} />
        <directionalLight 
          position={[10, 20, 10]} 
          intensity={1.5} 
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
        />
        <pointLight position={[-10, -10, -10]} intensity={0.5} />
        
        <SurfaceMesh 
          matrix={matrix} 
          defects={defects} 
          heightScale={0.3} 
        />
        
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
    </div>
  );
}