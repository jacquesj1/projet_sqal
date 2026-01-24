'use client'

import { motion } from 'framer-motion'
import { Card, CardContent } from '@/components/ui/card'
import { Shield, Eye, Award, Clock, MapPin, Smartphone } from 'lucide-react'

const features = [
  {
    icon: Shield,
    title: 'Blockchain Sécurisé',
    description: 'Toutes les données sont enregistrées de manière immuable sur la blockchain Hyperledger Fabric.',
    color: 'text-blue-600',
    bgColor: 'bg-blue-100'
  },
  {
    icon: Eye,
    title: 'Transparence Totale',
    description: 'Accédez à toutes les informations sur l\'origine, la qualité et le parcours de votre produit.',
    color: 'text-green-600',
    bgColor: 'bg-green-100'
  },
  {
    icon: Award,
    title: 'Qualité Certifiée',
    description: 'Nos analyses IA garantissent des standards de qualité exceptionnels pour tous nos produits.',
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-100'
  },
  {
    icon: Clock,
    title: 'Temps Réel',
    description: 'Informations mises à jour en temps réel tout au long de la chaîne de production.',
    color: 'text-purple-600',
    bgColor: 'bg-purple-100'
  },
  {
    icon: MapPin,
    title: 'Géolocalisation',
    description: 'Tracez le parcours géographique exact de votre produit depuis l\'élevage.',
    color: 'text-red-600',
    bgColor: 'bg-red-100'
  },
  {
    icon: Smartphone,
    title: 'Mobile First',
    description: 'Scannez facilement depuis votre smartphone où que vous soyez.',
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-100'
  }
]

export function FeaturesSection() {
  return (
    <section className="py-24 bg-gray-50" id="features">
      <div className="max-w-7xl mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
            Pourquoi choisir notre traçabilité ?
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Notre système révolutionnaire combine blockchain, IA et géolocalisation 
            pour vous offrir une transparence totale sur vos produits.
          </p>
        </motion.div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
            >
              <Card className="h-full border-0 shadow-lg hover:shadow-xl transition-shadow duration-300">
                <CardContent className="p-8">
                  <div className="text-center space-y-4">
                    <div className={`mx-auto w-16 h-16 ${feature.bgColor} rounded-2xl flex items-center justify-center`}>
                      <feature.icon className={`w-8 h-8 ${feature.color}`} />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900">
                      {feature.title}
                    </h3>
                    <p className="text-gray-600 leading-relaxed">
                      {feature.description}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}