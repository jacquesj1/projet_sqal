'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Clock, MapPin, CheckCircle, ArrowDown } from 'lucide-react'

interface Props {
  data: any[]
}

export function TraceabilityTimeline({ data }: Props) {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="w-5 h-5 text-green-600" />
      case 'in_progress': return <Clock className="w-5 h-5 text-blue-600" />
      default: return <Clock className="w-5 h-5 text-gray-400" />
    }
  }
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800 border-green-300'
      case 'in_progress': return 'bg-blue-100 text-blue-800 border-blue-300'
      default: return 'bg-gray-100 text-gray-800 border-gray-300'
    }
  }
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Clock className="w-5 h-5" />
          <span>Parcours de Traçabilité</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {data.map((step, index) => (
            <div key={step.id || index} className="relative">
              <div className="flex items-start space-x-4">
                {/* Icon */}
                <div className="flex-shrink-0 mt-1">
                  {getStatusIcon(step.status)}
                </div>
                
                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h4 className="text-lg font-semibold text-gray-900">
                      {step.title}
                    </h4>
                    <Badge className={`${getStatusColor(step.status)} border`}>
                      {step.status === 'completed' ? 'Terminé' : 
                       step.status === 'in_progress' ? 'En cours' : 'En attente'}
                    </Badge>
                  </div>
                  
                  <p className="text-gray-600 mt-1">{step.description}</p>
                  
                  <div className="flex items-center space-x-4 mt-3 text-sm text-gray-500">
                    <div className="flex items-center space-x-1">
                      <Clock className="w-4 h-4" />
                      <span>{step.date}</span>
                    </div>
                    {step.location && (
                      <div className="flex items-center space-x-1">
                        <MapPin className="w-4 h-4" />
                        <span>{step.location}</span>
                      </div>
                    )}
                  </div>
                  
                  {step.details && (
                    <div className="mt-3 p-3 bg-gray-50 rounded text-sm">
                      <strong>Détails:</strong> {step.details}
                    </div>
                  )}
                </div>
              </div>
              
              {/* Line connector */}
              {index < data.length - 1 && (
                <div className="absolute left-2 top-8 w-0.5 h-6 bg-gray-300" />
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}