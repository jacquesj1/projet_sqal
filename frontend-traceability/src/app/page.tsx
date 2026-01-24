'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { HeroSection } from '@/components/home/hero-section'
import { QrScanner } from '@/components/scanner/qr-scanner'
import { ManualInput } from '@/components/home/manual-input'
import { FeaturesSection } from '@/components/home/features-section'
import { HowItWorksSection } from '@/components/home/how-it-works-section'
import { AboutSection } from '@/components/home/about-section'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Camera, Hash, Smartphone, Shield, Award, Eye } from 'lucide-react'
import { motion } from 'framer-motion'
import { toast } from 'react-hot-toast'

export default function HomePage() {
  const [isScanning, setIsScanning] = useState(false)
  const [activeTab, setActiveTab] = useState('scanner')
  const router = useRouter()
  
  const handleScanSuccess = (qrCode: string) => {
    console.log('QR Code scanné:', qrCode)
    toast.success('QR Code détecté!')
    
    // Extraire l'ID de traçabilité du QR code
    const traceId = extractTraceId(qrCode)
    if (traceId) {
      router.push(`/trace/${traceId}`)
    } else {
      toast.error('QR Code invalide')
    }
  }
  
  const handleManualSubmit = (traceId: string) => {
    if (traceId.length >= 8) {
      router.push(`/trace/${traceId}`)
    } else {
      toast.error('Identifiant trop court')
    }
  }
  
  const extractTraceId = (qrCode: string): string | null => {
    // Logique d'extraction de l'ID depuis le QR code
    try {
      const url = new URL(qrCode)
      const pathParts = url.pathname.split('/')
      return pathParts[pathParts.length - 1] || null
    } catch {
      // Si ce n'est pas une URL, considérer que c'est directement l'ID
      return qrCode.length >= 8 ? qrCode : null
    }
  }
  
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <HeroSection />
      
      {/* Scanner/Input Section */}
      <section className="py-16 bg-white" id="scanner">
        <div className="max-w-4xl mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Vérifiez votre produit
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Scannez le QR code ou saisissez l'identifiant pour accéder aux informations 
              complètes de traçabilité de votre produit.
            </p>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <Card className="overflow-hidden shadow-xl">
              <CardContent className="p-0">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                  <TabsList className="grid w-full grid-cols-2 rounded-none bg-gray-50">
                    <TabsTrigger value="scanner" className="flex items-center space-x-2 py-4">
                      <Camera className="w-5 h-5" />
                      <span>Scanner QR</span>
                    </TabsTrigger>
                    <TabsTrigger value="manual" className="flex items-center space-x-2 py-4">
                      <Hash className="w-5 h-5" />
                      <span>Saisie manuelle</span>
                    </TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="scanner" className="p-8">
                    <div className="space-y-6">
                      <div className="text-center">
                        <Smartphone className="w-12 h-12 text-primary-500 mx-auto mb-4" />
                        <h3 className="text-xl font-semibold mb-2">Scanner avec votre appareil</h3>
                        <p className="text-gray-600">
                          Autorisez l'accès à la caméra et pointez vers le QR code
                        </p>
                      </div>
                      
                      {isScanning ? (
                        <QrScanner
                          onScanSuccess={handleScanSuccess}
                          onError={(error) => {
                            console.error('Erreur scanner:', error)
                            toast.error('Erreur du scanner')
                            setIsScanning(false)
                          }}
                        />
                      ) : (
                        <div className="text-center">
                          <Button
                            onClick={() => setIsScanning(true)}
                            size="lg"
                            className="bg-primary-600 hover:bg-primary-700 text-white px-8 py-3"
                          >
                            <Camera className="w-5 h-5 mr-2" />
                            Démarrer le scanner
                          </Button>
                        </div>
                      )}
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="manual" className="p-8">
                    <ManualInput onSubmit={handleManualSubmit} />
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </section>
      
      {/* Features Section */}
      <FeaturesSection />
      
      {/* How It Works Section */}
      <HowItWorksSection />
      
      {/* About Section */}
      <AboutSection />
    </div>
  )
}