'use client'

import { motion } from 'framer-motion'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Calendar, MapPin, Award, Shield } from 'lucide-react'
import { TraceabilityData } from '@/types'

interface Props {
  data: TraceabilityData
}

export function TraceabilityHeader({ data }: Props) {
  const getQualityColor = (grade: string) => {
    switch (grade) {
      case 'excellent': return 'bg-green-100 text-green-800 border-green-300'
      case 'good': return 'bg-yellow-100 text-yellow-800 border-yellow-300'
      case 'poor': return 'bg-red-100 text-red-800 border-red-300'
      default: return 'bg-gray-100 text-gray-800 border-gray-300'
    }
  }
  
  return (
    <Card className="border-0 shadow-lg bg-gradient-to-r from-primary-50 to-white">
      <CardContent className="p-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Product Info */}
          <div className="space-y-6">
            <div>
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-12 h-12 bg-primary-600 rounded-lg flex items-center justify-center">
                  <Award className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">
                    {data.product.name}
                  </h1>
                  <p className="text-gray-600">{data.product.category}</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <Badge 
                  className={`${getQualityColor(data.quality.grade)} border px-3 py-1`}
                >
                  Qualité {data.quality.grade === 'excellent' ? 'Excellente' : 
                          data.quality.grade === 'good' ? 'Correcte' : 'Faible'}
                </Badge>
                <Badge variant="outline" className="border-gray-300">
                  Score: {data.quality.score}%
                </Badge>
              </div>
            </div>
            
            <p className="text-gray-700 leading-relaxed">
              {data.product.description}
            </p>
          </div>
          
          {/* Key Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white rounded-lg p-4 border border-gray-200">
              <div className="flex items-center space-x-3">
                <Calendar className="w-5 h-5 text-primary-600" />
                <div>
                  <div className="text-sm text-gray-600">Date de production</div>
                  <div className="font-semibold">{data.product.production_date}</div>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-lg p-4 border border-gray-200">
              <div className="flex items-center space-x-3">
                <MapPin className="w-5 h-5 text-primary-600" />
                <div>
                  <div className="text-sm text-gray-600">Origine</div>
                  <div className="font-semibold">{data.gaveur.location}</div>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-lg p-4 border border-gray-200">
              <div className="flex items-center space-x-3">
                <Shield className="w-5 h-5 text-primary-600" />
                <div>
                  <div className="text-sm text-gray-600">Certification</div>
                  <div className="font-semibold">IGP Sud-Ouest</div>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-lg p-4 border border-gray-200">
              <div className="flex items-center space-x-3">
                <div className="w-5 h-5 bg-green-500 rounded-full" />
                <div>
                  <div className="text-sm text-gray-600">État</div>
                  <div className="font-semibold">Certifié</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}