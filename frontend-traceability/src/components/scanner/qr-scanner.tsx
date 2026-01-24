'use client'

import { useEffect, useRef, useState } from 'react'
import QrScannerLib from 'qr-scanner'
import { motion } from 'framer-motion'
import { Camera, X, RotateCw, ZoomIn, ZoomOut } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  onScanSuccess: (result: string) => void
  onError?: (error: string) => void
}

export function QrScanner({ onScanSuccess, onError }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const scannerRef = useRef<QrScannerLib | null>(null)
  const [isScanning, setIsScanning] = useState(false)
  const [error, setError] = useState<string>('')
  const [cameras, setCameras] = useState<QrScannerLib.Camera[]>([])
  const [currentCamera, setCurrentCamera] = useState<string>('')
  
  useEffect(() => {
    if (!videoRef.current) return
    
    const initScanner = async () => {
      try {
        // Get available cameras
        const availableCameras = await QrScannerLib.listCameras(true)
        setCameras(availableCameras)

        const scanner = new QrScannerLib(
          videoRef.current!,
          (result) => {
            console.log('QR Code detected:', result.data)
            onScanSuccess(result.data)
          },
          {
            highlightScanRegion: true,
            highlightCodeOutline: true,
            preferredCamera: 'environment', // Back camera on mobile
          }
        )
        
        scannerRef.current = scanner

        await scanner.start()
        setIsScanning(true)
        setError('')

        // Set current camera after start
        if (availableCameras.length > 0) {
          setCurrentCamera(availableCameras[0].id)
        }
        
      } catch (err: any) {
        console.error('Scanner init error:', err)
        setError('Impossible d\'accéder à la caméra. Vérifiez les permissions.')
        onError?.(err.message)
      }
    }
    
    initScanner()
    
    return () => {
      if (scannerRef.current) {
        scannerRef.current.destroy()
        scannerRef.current = null
      }
    }
  }, [onScanSuccess, onError])
  
  const switchCamera = async () => {
    if (!scannerRef.current || cameras.length <= 1) return
    
    try {
      const currentIndex = cameras.findIndex(cam => cam.id === currentCamera)
      const nextIndex = (currentIndex + 1) % cameras.length
      const nextCamera = cameras[nextIndex]
      
      await scannerRef.current.setCamera(nextCamera.id)
      setCurrentCamera(nextCamera.id)
    } catch (err) {
      console.error('Camera switch error:', err)
    }
  }
  
  const toggleTorch = async () => {
    if (!scannerRef.current) return

    try {
      await scannerRef.current.toggleFlash()
    } catch (err) {
      console.error('Torch error:', err)
    }
  }
  
  if (error) {
    return (
      <div className="qr-scanner-container">
        <div className="aspect-square bg-gray-100 rounded-xl flex items-center justify-center">
          <div className="text-center p-8">
            <Camera className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 text-sm mb-4">{error}</p>
            <Button 
              onClick={() => window.location.reload()} 
              variant="outline" 
              size="sm"
            >
              Réessayer
            </Button>
          </div>
        </div>
      </div>
    )
  }
  
  return (
    <div className="relative">
      <div className="qr-scanner-container">
        <video
          ref={videoRef}
          className="w-full aspect-square object-cover rounded-xl"
          playsInline
          muted
        />
        
        {/* Overlay */}
        <div className="qr-scanner-overlay">
          <div className="qr-scanner-corners" />
          <div className="scan-line" />
        </div>
        
        {/* Status Indicator */}
        {isScanning && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute top-4 left-4 bg-green-500 text-white px-3 py-1 rounded-full text-sm flex items-center space-x-2"
          >
            <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
            <span>Scanning...</span>
          </motion.div>
        )}
        
        {/* Controls */}
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex items-center space-x-2">
          {cameras.length > 1 && (
            <Button
              onClick={switchCamera}
              variant="outline"
              size="sm"
              className="bg-white/90 backdrop-blur"
            >
              <RotateCw className="w-4 h-4" />
            </Button>
          )}
          
          <Button
            onClick={toggleTorch}
            variant="outline"
            size="sm"
            className="bg-white/90 backdrop-blur"
          >
            💡
          </Button>
        </div>
      </div>
      
      <div className="text-center mt-4 space-y-2">
        <p className="text-sm text-gray-600">
          Pointez la caméra vers un QR code
        </p>
        <p className="text-xs text-gray-500">
          Maintenez l'appareil stable pour un meilleur résultat
        </p>
      </div>
    </div>
  )
}