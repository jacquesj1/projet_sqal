'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Package, Weight, Calendar, Barcode } from 'lucide-react'

interface Props {
  data: any
}

export function ProductInfo({ data }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Package className="w-5 h-5" />
          <span>Informations Produit</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-600">Nom du produit</label>
              <p className="text-lg font-semibold">{data.name}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600">Catégorie</label>
              <p className="text-gray-900">{data.category}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600">Poids net</label>
              <div className="flex items-center space-x-2">
                <Weight className="w-4 h-4 text-gray-500" />
                <span className="font-semibold">{data.weight}</span>
              </div>
            </div>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-600">Date de production</label>
              <div className="flex items-center space-x-2">
                <Calendar className="w-4 h-4 text-gray-500" />
                <span className="font-semibold">{data.production_date}</span>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600">Code produit</label>
              <div className="flex items-center space-x-2">
                <Barcode className="w-4 h-4 text-gray-500" />
                <span className="font-mono text-sm">{data.product_code}</span>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600">Certifications</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {data.certifications?.map((cert: string, index: number) => (
                  <Badge key={index} variant="outline">{cert}</Badge>
                ))}
              </div>
            </div>
          </div>
        </div>
        
        <div className="pt-4 border-t">
          <label className="text-sm font-medium text-gray-600">Description</label>
          <p className="text-gray-700 leading-relaxed mt-1">{data.description}</p>
        </div>
      </CardContent>
    </Card>
  )
}