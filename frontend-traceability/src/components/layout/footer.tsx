'use client'

import Link from 'next/link'
import { Building2, Mail, Phone, MapPin, ExternalLink } from 'lucide-react'

export function Footer() {
  return (
    <footer className="bg-gray-900 text-white">
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Company Info */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Building2 className="w-8 h-8 text-primary-400" />
              <div>
                <div className="font-bold text-lg">Euralis</div>
                <div className="text-sm text-gray-400">Traçabilité</div>
              </div>
            </div>
            <p className="text-gray-400 text-sm">
              Leader du foie gras et des produits du Sud-Ouest, 
              Euralis garantit une traçabilité totale grâce à la blockchain.
            </p>
          </div>
          
          {/* Quick Links */}
          <div className="space-y-4">
            <h3 className="font-semibold">Liens Rapides</h3>
            <div className="space-y-2 text-sm">
              <Link href="#scanner" className="block text-gray-400 hover:text-white transition-colors">
                Scanner QR
              </Link>
              <Link href="#features" className="block text-gray-400 hover:text-white transition-colors">
                Fonctionnalités
              </Link>
              <a 
                href="https://www.euralis.fr" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center text-gray-400 hover:text-white transition-colors"
              >
                Site Euralis
                <ExternalLink className="w-3 h-3 ml-1" />
              </a>
            </div>
          </div>
          
          {/* Support */}
          <div className="space-y-4">
            <h3 className="font-semibold">Support</h3>
            <div className="space-y-2 text-sm text-gray-400">
              <div>FAQ</div>
              <div>Guide d'utilisation</div>
              <div>Contactez-nous</div>
            </div>
          </div>
          
          {/* Contact */}
          <div className="space-y-4">
            <h3 className="font-semibold">Contact</h3>
            <div className="space-y-3 text-sm text-gray-400">
              <div className="flex items-center space-x-2">
                <Mail className="w-4 h-4 flex-shrink-0" />
                <span>tracabilite@euralis.fr</span>
              </div>
              <div className="flex items-center space-x-2">
                <Phone className="w-4 h-4 flex-shrink-0" />
                <span>05 59 XX XX XX</span>
              </div>
              <div className="flex items-start space-x-2">
                <MapPin className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>Euralis<br />64230 Lescar<br />France</span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="border-t border-gray-800 mt-12 pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
            <div className="text-sm text-gray-400">
              © 2025 Euralis. Tous droits réservés.
            </div>
            <div className="flex items-center space-x-6 text-sm text-gray-400">
              <Link href="#" className="hover:text-white transition-colors">
                Mentions légales
              </Link>
              <Link href="#" className="hover:text-white transition-colors">
                Confidentialité
              </Link>
              <Link href="#" className="hover:text-white transition-colors">
                Cookies
              </Link>
            </div>
          </div>
          
          <div className="text-center text-xs text-gray-500 mt-4">
            Développé par A Deep Adventure • Système Gaveurs v2.1
          </div>
        </div>
      </div>
    </footer>
  )
}