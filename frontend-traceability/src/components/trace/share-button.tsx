'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Share2, Copy, Check } from 'lucide-react'
import { toast } from 'react-hot-toast'

interface Props {
  data: any
  traceId: string
}

export function ShareButton({ data, traceId }: Props) {
  const [copied, setCopied] = useState(false)
  
  const shareUrl = `${window.location.origin}/trace/${traceId}`
  
  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Traçabilité - ${data.product.name}`,
          text: `Découvrez l'origine et la qualité de ce produit Euralis`,
          url: shareUrl,
        })
      } catch (error) {
        // User cancelled sharing
      }
    } else {
      // Fallback to copy to clipboard
      await handleCopy()
    }
  }
  
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      toast.success('Lien copié!')
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      toast.error('Erreur lors de la copie')
    }
  }
  
  return (
    <div className="flex items-center space-x-2">
      <Button onClick={handleShare} variant="outline" size="sm">
        <Share2 className="w-4 h-4 mr-2" />
        Partager
      </Button>
      
      <Button onClick={handleCopy} variant="outline" size="sm">
        {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
        {copied ? 'Copié' : 'Copier lien'}
      </Button>
    </div>
  )
}