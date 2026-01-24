'use client'

import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Smartphone, QrCode, Shield, Award } from 'lucide-react'
import Link from 'next/link'

export function HeroSection() {
  const scrollToScanner = () => {
    const element = document.getElementById('scanner')
    element?.scrollIntoView({ behavior: 'smooth' })
  }
  
  return (
    <section className="relative hero-gradient overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-hero-pattern opacity-5" />
      
      <div className="relative max-w-7xl mx-auto px-4 py-24 sm:py-32">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Content */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            className="space-y-8"
          >
            <div className="space-y-4">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.2 }}
                className="inline-flex items-center rounded-full bg-primary-100 px-4 py-2 text-sm font-medium text-primary-800"
              >
                <Shield className="mr-2 h-4 w-4" />
                Traçabilité Blockchain Certifiée
              </motion.div>
              
              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.3 }}
                className="text-4xl sm:text-6xl font-bold text-gray-900 leading-tight"
              >
                Découvrez l'origine de{' '}
                <span className="hero-text-gradient">vos produits</span>
              </motion.h1>
              
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.4 }}
                className="text-xl text-gray-600 max-w-xl leading-relaxed"
              >
                Grâce à notre système de traçabilité blockchain, vérifiez en temps réel 
                l'origine, la qualité et le parcours de vos produits Euralis.
              </motion.p>
            </div>
            
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.5 }}
              className="flex flex-col sm:flex-row gap-4"
            >
              <Button
                onClick={scrollToScanner}
                size="lg"
                className="bg-primary-600 hover:bg-primary-700 text-white px-8 py-4 text-lg shadow-lg hover:shadow-xl transition-all duration-200"
              >
                <QrCode className="mr-3 h-5 w-5" />
                Scanner un QR Code
              </Button>
              
              <Button
                variant="outline"
                size="lg"
                className="px-8 py-4 text-lg border-2 border-primary-600 text-primary-600 hover:bg-primary-50"
                asChild
              >
                <Link href="#features">En savoir plus</Link>
              </Button>
            </motion.div>
            
            {/* Stats */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.6 }}
              className="flex items-center space-x-8 pt-8"
            >
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">1M+</div>
                <div className="text-sm text-gray-600">Produits tracés</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">500+</div>
                <div className="text-sm text-gray-600">Gaveurs partenaires</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">100%</div>
                <div className="text-sm text-gray-600">Blockchain sécurisé</div>
              </div>
            </motion.div>
          </motion.div>
          
          {/* Visual */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="relative"
          >
            <div className="relative mx-auto w-80 h-80 lg:w-96 lg:h-96">
              {/* Phone Mockup */}
              <div className="relative bg-white rounded-3xl shadow-2xl p-4 transform rotate-3 hover:rotate-0 transition-transform duration-500">
                <div className="bg-gray-900 rounded-2xl h-full flex flex-col overflow-hidden">
                  {/* Screen */}
                  <div className="flex-1 bg-gradient-to-br from-primary-500 to-primary-600 p-6 flex flex-col justify-center items-center text-white relative">
                    <QrCode className="w-24 h-24 mb-4 animate-bounce-gentle" />
                    <div className="text-center">
                      <div className="text-lg font-semibold mb-2">Produit Vérifié</div>
                      <div className="text-sm opacity-90">Qualité Excellente</div>
                    </div>
                    
                    {/* Floating Elements */}
                    <div className="absolute top-4 right-4">
                      <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse" />
                    </div>
                    <div className="absolute bottom-4 left-4">
                      <Award className="w-6 h-6 text-yellow-300" />
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Floating Elements */}
              <motion.div
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 3, repeat: Infinity }}
                className="absolute top-0 right-0 bg-white rounded-lg shadow-lg p-3"
              >
                <Shield className="w-6 h-6 text-green-500" />
              </motion.div>
              
              <motion.div
                animate={{ y: [0, 10, 0] }}
                transition={{ duration: 3, repeat: Infinity, delay: 1.5 }}
                className="absolute bottom-10 -left-4 bg-white rounded-lg shadow-lg p-3"
              >
                <Award className="w-6 h-6 text-yellow-500" />
              </motion.div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}