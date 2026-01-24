'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { User, MapPin, Phone, Mail, Star } from 'lucide-react'

interface Props {
  data: any
}

export function GaveurInfo({ data }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <User className="w-5 h-5" />
          <span>Informations Gaveur</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="text-center">
          <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <User className="w-8 h-8 text-primary-600" />
          </div>
          <h3 className="text-lg font-semibold">{data.name}</h3>
          <p className="text-gray-600">{data.farm_name}</p>
        </div>
        
        <div className="space-y-3">
          <div className="flex items-center space-x-3">
            <MapPin className="w-4 h-4 text-gray-500 flex-shrink-0" />
            <span className="text-sm">{data.address}</span>
          </div>
          
          {data.phone && (
            <div className="flex items-center space-x-3">
              <Phone className="w-4 h-4 text-gray-500 flex-shrink-0" />
              <span className="text-sm">{data.phone}</span>
            </div>
          )}
          
          {data.email && (
            <div className="flex items-center space-x-3">
              <Mail className="w-4 h-4 text-gray-500 flex-shrink-0" />
              <span className="text-sm">{data.email}</span>
            </div>
          )}
        </div>
        
        <div className="pt-4 border-t">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium">Performance</span>
            <div className="flex items-center space-x-1">
              <Star className="w-4 h-4 text-yellow-500 fill-current" />
              <span className="text-sm font-semibold">{data.performance_score}%</span>
            </div>
          </div>
          
          <div className="space-y-2">
            <Badge variant="outline" className="w-full justify-center">
              {data.certifications?.[0] || 'Certifié Euralis'}
            </Badge>
            <Badge variant="outline" className="w-full justify-center">
              {data.animals_count} animaux en élevage
            </Badge>
          </div>
        </div>
        
        {data.description && (
          <div className="pt-4 border-t">
            <h4 className="font-medium mb-2">À propos</h4>
            <p className="text-sm text-gray-600 leading-relaxed">{data.description}</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}