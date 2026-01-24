'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Award, TrendingUp, Eye, CheckCircle } from 'lucide-react'

interface Props {
  data: any
}

export function QualityMetrics({ data }: Props) {
  const getGradeColor = (grade: string) => {
    switch (grade) {
      case 'excellent': return 'text-green-600 bg-green-100'
      case 'good': return 'text-yellow-600 bg-yellow-100'
      case 'poor': return 'text-red-600 bg-red-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Award className="w-5 h-5" />
          <span>Métriques de Qualité</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="text-center py-6">
          <div className={`inline-flex items-center justify-center w-24 h-24 rounded-full ${getGradeColor(data.grade)} mb-4`}>
            <span className="text-2xl font-bold">{data.score}%</span>
          </div>
          <Badge className={`${getGradeColor(data.grade)} border px-4 py-2 text-sm`}>
            Qualité {data.grade === 'excellent' ? 'Excellente' : 
                    data.grade === 'good' ? 'Correcte' : 'Faible'}
          </Badge>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <TrendingUp className="w-8 h-8 text-blue-600 mx-auto mb-2" />
            <div className="text-2xl font-bold text-gray-900">{data.metrics?.texture || 'A+'}</div>
            <div className="text-sm text-gray-600">Texture</div>
          </div>
          
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <Eye className="w-8 h-8 text-green-600 mx-auto mb-2" />
            <div className="text-2xl font-bold text-gray-900">{data.metrics?.appearance || 'A'}</div>
            <div className="text-sm text-gray-600">Apparence</div>
          </div>
          
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <CheckCircle className="w-8 h-8 text-purple-600 mx-auto mb-2" />
            <div className="text-2xl font-bold text-gray-900">{data.metrics?.taste || 'A+'}</div>
            <div className="text-sm text-gray-600">Goût</div>
          </div>
        </div>
        
        {data.analysis && (
          <div className="bg-blue-50 p-4 rounded-lg">
            <h4 className="font-semibold text-blue-900 mb-2">Analyse IA</h4>
            <p className="text-blue-800 text-sm">{data.analysis}</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}