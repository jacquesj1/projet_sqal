'use client'

import { motion } from 'framer-motion'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Building2, Users, Award, Globe } from 'lucide-react'

export function AboutSection() {
  const stats = [
    { icon: Building2, value: '75+', label: 'Années d\'expérience' },
    { icon: Users, value: '500+', label: 'Gaveurs partenaires' },
    { icon: Award, value: '95%', label: 'Satisfaction client' },
    { icon: Globe, value: '50+', label: 'Pays exportés' }
  ]
  
  return (
    <section className="py-24 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Content */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="space-y-8"
          >
            <div className="space-y-4">
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">
                Euralis, l'excellence depuis 1950
              </h2>
              <p className="text-lg text-gray-600 leading-relaxed">
                Leader français du foie gras et des produits du Sud-Ouest, 
                Euralis s'engage pour une production responsable et transparente. 
                Notre système de traçabilité blockchain témoigne de notre engagement 
                pour la qualité et la confiance.
              </p>
              <p className="text-gray-600 leading-relaxed">
                Chaque produit est le fruit d'un savoir-faire artisanal transmis 
                de génération en génération, allié aux technologies les plus avancées 
                pour garantir traçabilité et excellence.
              </p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4">
              <Button 
                size="lg"
                className="bg-primary-600 hover:bg-primary-700"
                asChild
              >
                <a href="https://www.euralis.fr" target="_blank" rel="noopener noreferrer">
                  Découvrir Euralis
                </a>
              </Button>
              <Button variant="outline" size="lg">
                Nos certifications
              </Button>
            </div>
          </motion.div>
          
          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="grid grid-cols-2 gap-6"
          >
            {stats.map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
              >
                <Card className="text-center border-0 shadow-lg">
                  <CardContent className="p-8 space-y-4">
                    <div className="mx-auto w-16 h-16 bg-primary-100 rounded-2xl flex items-center justify-center">
                      <stat.icon className="w-8 h-8 text-primary-600" />
                    </div>
                    <div className="space-y-2">
                      <div className="text-3xl font-bold text-gray-900">
                        {stat.value}
                      </div>
                      <div className="text-sm text-gray-600">
                        {stat.label}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  )
}