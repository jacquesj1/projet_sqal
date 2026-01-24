'use client'

import { motion } from 'framer-motion'
import { Card, CardContent } from '@/components/ui/card'
import { QrCode, Search, FileText, CheckCircle } from 'lucide-react'

const steps = [
  {
    step: 1,
    icon: QrCode,
    title: 'Scannez le QR Code',
    description: 'Utilisez votre smartphone pour scanner le QR code présent sur l\'emballage de votre produit.',
    color: 'bg-blue-500'
  },
  {
    step: 2,
    icon: Search,
    title: 'Vérification Automatique',
    description: 'Nos serveurs interrogent la blockchain pour récupérer toutes les données de traçabilité.',
    color: 'bg-green-500'
  },
  {
    step: 3,
    icon: FileText,
    title: 'Informations Complètes',
    description: 'Consultez l\'origine, la qualité, les contrôles et le parcours complet de votre produit.',
    color: 'bg-purple-500'
  },
  {
    step: 4,
    icon: CheckCircle,
    title: 'Confiance Garantie',
    description: 'Profitez d\'un produit dont vous connaissez parfaitement l\'histoire et la qualité.',
    color: 'bg-yellow-500'
  }
]

export function HowItWorksSection() {
  return (
    <section className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
            Comment ça fonctionne ?
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            En 4 étapes simples, découvrez tout sur votre produit
          </p>
        </motion.div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {steps.map((step, index) => (
            <motion.div
              key={step.step}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              className="relative"
            >
              <Card className="h-full border-0 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
                <CardContent className="p-8 text-center space-y-6">
                  {/* Step Number */}
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <div className={`w-8 h-8 ${step.color} rounded-full flex items-center justify-center text-white text-sm font-bold`}>
                      {step.step}
                    </div>
                  </div>
                  
                  {/* Icon */}
                  <div className="pt-4">
                    <div className="mx-auto w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center">
                      <step.icon className="w-8 h-8 text-gray-700" />
                    </div>
                  </div>
                  
                  {/* Content */}
                  <div className="space-y-3">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {step.title}
                    </h3>
                    <p className="text-gray-600 text-sm leading-relaxed">
                      {step.description}
                    </p>
                  </div>
                </CardContent>
              </Card>
              
              {/* Arrow for desktop */}
              {index < steps.length - 1 && (
                <div className="hidden lg:block absolute top-1/2 -right-4 transform -translate-y-1/2 z-10">
                  <div className="w-8 h-0.5 bg-gray-300" />
                  <div className="absolute right-0 top-1/2 transform -translate-y-1/2 w-2 h-2 bg-gray-300 rotate-45" 
                       style={{ clipPath: 'polygon(0 0, 100% 50%, 0 100%)' }} />
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}