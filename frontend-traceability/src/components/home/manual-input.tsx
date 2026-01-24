'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Hash, Search } from 'lucide-react'
import { toast } from 'react-hot-toast'

interface ManualInputProps {
  onSubmit: (traceId: string) => void
}

export function ManualInput({ onSubmit }: ManualInputProps) {
  const [traceId, setTraceId] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!traceId.trim()) {
      toast.error('Veuillez saisir un identifiant')
      return
    }
    
    if (traceId.length < 8) {
      toast.error('L\'identifiant doit contenir au moins 8 caractères')
      return
    }
    
    setIsSubmitting(true)
    try {
      onSubmit(traceId.trim())
    } catch (error) {
      toast.error('Erreur lors de la vérification')
    } finally {
      setIsSubmitting(false)
    }
  }
  
  return (
    <div className="space-y-6">
      <div className="text-center">
        <Hash className="w-12 h-12 text-primary-500 mx-auto mb-4" />
        <h3 className="text-xl font-semibold mb-2">Saisie manuelle</h3>
        <p className="text-gray-600">
          Entrez l'identifiant de traçabilité de votre produit
        </p>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="traceId" className="block text-sm font-medium text-gray-700 mb-2">
            Identifiant de traçabilité
          </label>
          <Input
            id="traceId"
            type="text"
            value={traceId}
            onChange={(e) => setTraceId(e.target.value)}
            placeholder="Ex: TR2025ABC123DEF456"
            className="text-center text-lg tracking-wider font-mono"
            maxLength={32}
          />
          <p className="text-xs text-gray-500 mt-1">
            Vous trouverez cet identifiant sur l'emballage de votre produit
          </p>
        </div>
        
        <Button
          type="submit"
          disabled={!traceId.trim() || traceId.length < 8 || isSubmitting}
          className="w-full bg-primary-600 hover:bg-primary-700 text-white py-3"
          size="lg"
        >
          {isSubmitting ? (
            <>
              <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2" />
              Vérification en cours...
            </>
          ) : (
            <>
              <Search className="w-5 h-5 mr-2" />
              Vérifier le produit
            </>
          )}
        </Button>
      </form>
      
      <div className="text-center text-sm text-gray-500">
        <p>L'identifiant est sensible à la casse</p>
        <p>Format: 16-32 caractères alphanumériques</p>
      </div>
    </div>
  )
}