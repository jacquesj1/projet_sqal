'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { TraceabilityHeader } from '@/components/trace/traceability-header'
import { ProductInfo } from '@/components/trace/product-info'
import { QualityMetrics } from '@/components/trace/quality-metrics'
import { TraceabilityTimeline } from '@/components/trace/traceability-timeline'
import { GaveurInfo } from '@/components/trace/gaveur-info'
import { BlockchainVerification } from '@/components/trace/blockchain-verification'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { ErrorMessage } from '@/components/ui/error-message'
import { ShareButton } from '@/components/trace/share-button'
import { useAPI } from '@/lib/api/client'
import { TraceabilityData } from '@/types'
import { motion } from 'framer-motion'
import { ArrowLeft, Download, Share2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { toast } from 'react-hot-toast'

export default function TracePage() {
  const params = useParams()
  const traceId = params.traceId as string
  
  const [data, setData] = useState<TraceabilityData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const api = useAPI()
  
  useEffect(() => {
    if (!traceId) return
    
    const loadTraceabilityData = async () => {
      setIsLoading(true)
      setError(null)
      
      try {
        const response = await api.get(`/api/public/traceability/${traceId}`)
        setData(response.data)
      } catch (err: any) {
        console.error('Erreur chargement traçabilité:', err)
        setError(
          err.response?.status === 404 
            ? 'Produit non trouvé. Vérifiez l\'identifiant de traçabilité.'
            : 'Erreur lors du chargement des données de traçabilité.'
        )
      } finally {
        setIsLoading(false)
      }
    }
    
    loadTraceabilityData()
  }, [traceId, api])
  
  const handleDownloadReport = async () => {
    try {
      const response = await api.get(`/api/public/traceability/${traceId}/report`, {
        responseType: 'blob'
      })
      
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `rapport-tracabilite-${traceId}.pdf`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      
      toast.success('Rapport téléchargé!')
    } catch (error) {
      console.error('Erreur téléchargement:', error)
      toast.error('Erreur lors du téléchargement')
    }
  }
  
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <LoadingSpinner size="lg" />
          <p className="mt-4 text-gray-600">Chargement des données de traçabilité...</p>
        </div>
      </div>
    )
  }
  
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <ErrorMessage 
          title="Données non trouvées"
          message={error}
          actionButton={
            <Link href="/">
              <Button variant="outline">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Retour à l'accueil
              </Button>
            </Link>
          }
        />
      </div>
    )
  }
  
  if (!data) {
    return null
  }
  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="bg-white shadow-sm border-b"
      >
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link href="/">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Retour
                </Button>
              </Link>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">
                  Traçabilité Produit
                </h1>
                <p className="text-sm text-gray-600">ID: {traceId}</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <ShareButton data={data} traceId={traceId} />
              <Button onClick={handleDownloadReport} variant="outline" size="sm">
                <Download className="w-4 h-4 mr-2" />
                Rapport PDF
              </Button>
            </div>
          </div>
        </div>
      </motion.div>
      
      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        {/* Header Info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <TraceabilityHeader data={data} />
        </motion.div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Product Info */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <ProductInfo data={data.product} />
            </motion.div>
            
            {/* Quality Metrics */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
            >
              <QualityMetrics data={data.quality} />
            </motion.div>
            
            {/* Traceability Timeline */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
            >
              <TraceabilityTimeline data={data.timeline} />
            </motion.div>
          </div>
          
          {/* Sidebar */}
          <div className="space-y-6">
            {/* Gaveur Info */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
            >
              <GaveurInfo data={data.gaveur} />
            </motion.div>
            
            {/* Blockchain Verification */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
            >
              <BlockchainVerification data={data.blockchain} />
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  )
}