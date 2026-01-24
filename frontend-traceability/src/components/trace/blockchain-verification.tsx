'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Shield, ExternalLink, Clock, CheckCircle } from 'lucide-react'

interface Props {
  data: any
}

export function BlockchainVerification({ data }: Props) {
  const handleViewOnExplorer = () => {
    if (data.transaction_hash) {
      const explorerUrl = `${process.env.NEXT_PUBLIC_BLOCKCHAIN_EXPLORER}/tx/${data.transaction_hash}`
      window.open(explorerUrl, '_blank')
    }
  }
  
  return (
    <Card className="border-green-200 bg-green-50">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2 text-green-800">
          <Shield className="w-5 h-5" />
          <span>Vérification Blockchain</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-center py-4">
          <div className="text-center">
            <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-3" />
            <Badge className="bg-green-100 text-green-800 border-green-300">
              ✓ Certifié Blockchain
            </Badge>
          </div>
        </div>
        
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Transaction:</span>
            <span className="font-mono text-xs break-all">
              {data.transaction_hash ? `${data.transaction_hash.slice(0, 16)}...` : 'N/A'}
            </span>
          </div>
          
          <div className="flex justify-between">
            <span className="text-gray-600">Block:</span>
            <span className="font-semibold">{data.block_number || 'N/A'}</span>
          </div>
          
          <div className="flex justify-between">
            <span className="text-gray-600">Confirmations:</span>
            <span className="font-semibold">{data.confirmations || 0}</span>
          </div>
          
          <div className="flex justify-between">
            <span className="text-gray-600">Horodatage:</span>
            <span className="font-semibold">{data.timestamp || 'N/A'}</span>
          </div>
        </div>
        
        <div className="pt-4 border-t border-green-200">
          <Button 
            onClick={handleViewOnExplorer}
            variant="outline"
            size="sm"
            className="w-full border-green-300 text-green-700 hover:bg-green-100"
            disabled={!data.transaction_hash}
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            Voir sur l'explorateur
          </Button>
        </div>
        
        <div className="bg-white p-3 rounded border border-green-200">
          <h4 className="font-medium text-green-800 mb-2">Garanties Blockchain</h4>
          <ul className="text-xs text-green-700 space-y-1">
            <li>• Données immuables et vérifiables</li>
            <li>• Traçabilité complète garantie</li>
            <li>• Authentification cryptographique</li>
            <li>• Transparence totale</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}