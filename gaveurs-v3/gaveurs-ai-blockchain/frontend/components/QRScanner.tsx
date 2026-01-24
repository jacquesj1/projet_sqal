'use client';

import { useState, useRef, useEffect } from 'react';
import { QrCode, Camera, StopCircle } from 'lucide-react';

interface QRScannerProps {
  onScan: (data: string) => void;
  onError?: (error: Error) => void;
}

export default function QRScanner({ onScan, onError }: QRScannerProps) {
  const [scanning, setScanning] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();

  const startScan = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });

      setStream(mediaStream);
      setScanning(true);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.play();
      }

      // Démarrer l'analyse des frames
      scanFrame();
    } catch (err) {
      console.error('Erreur accès caméra:', err);
      if (onError) onError(err as Error);
    }
  };

  const stopScan = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    setScanning(false);
  };

  const scanFrame = () => {
    if (!videoRef.current || !canvasRef.current) {
      animationRef.current = requestAnimationFrame(scanFrame);
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    if (video.readyState === video.HAVE_ENOUGH_DATA && ctx) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Ici, en production, on utiliserait une bibliothèque comme jsQR
      // Pour la démo, on simule un scan après quelques secondes
      // const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      // const code = jsQR(imageData.data, imageData.width, imageData.height);
      // if (code) { onScan(code.data); stopScan(); return; }
    }

    animationRef.current = requestAnimationFrame(scanFrame);
  };

  // Simulation de scan pour la démo
  useEffect(() => {
    if (scanning) {
      const timeout = setTimeout(() => {
        // Simuler la détection d'un QR code
        const mockData = `FR-40-2024-${String(Math.floor(Math.random() * 9999)).padStart(4, '0')}`;
        onScan(mockData);
        stopScan();
      }, 3000);

      return () => clearTimeout(timeout);
    }
  }, [scanning, onScan]);

  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [stream]);

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h3 className="font-bold text-xl mb-4 flex items-center gap-2">
        <QrCode size={24} />
        Scanner QR Code
      </h3>

      {!scanning ? (
        <button
          onClick={startScan}
          className="w-full bg-blue-600 text-white p-4 rounded-lg font-bold hover:bg-blue-700 flex items-center justify-center gap-2"
        >
          <Camera size={20} />
          Démarrer le scan
        </button>
      ) : (
        <div className="space-y-4">
          <div className="relative bg-black rounded-lg overflow-hidden">
            <video
              ref={videoRef}
              className="w-full h-64 object-cover"
              playsInline
              muted
            />
            <canvas ref={canvasRef} className="hidden" />

            {/* Overlay de scan */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-48 h-48 border-4 border-white rounded-lg relative">
                <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-blue-500"></div>
                <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-blue-500"></div>
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-blue-500"></div>
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-blue-500"></div>

                {/* Ligne de scan animée */}
                <div className="absolute inset-x-0 h-0.5 bg-blue-500 animate-scan"></div>
              </div>
            </div>

            <div className="absolute bottom-4 left-0 right-0 text-center">
              <p className="text-white text-sm bg-black/50 inline-block px-4 py-2 rounded">
                Positionnez le QR code dans le cadre
              </p>
            </div>
          </div>

          <button
            onClick={stopScan}
            className="w-full bg-red-600 text-white p-3 rounded-lg font-bold hover:bg-red-700 flex items-center justify-center gap-2"
          >
            <StopCircle size={20} />
            Arrêter le scan
          </button>
        </div>
      )}

      <style jsx>{`
        @keyframes scan {
          0% {
            top: 0;
          }
          50% {
            top: calc(100% - 2px);
          }
          100% {
            top: 0;
          }
        }
        .animate-scan {
          animation: scan 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
