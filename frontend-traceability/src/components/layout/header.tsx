'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Building2, QrCode, Globe } from 'lucide-react'

export function Header() {
  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50 backdrop-blur-sm bg-white/95">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-primary-600 rounded-lg flex items-center justify-center">
              <Building2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="font-bold text-lg text-gray-900">Euralis</div>
              <div className="text-xs text-gray-500">Traçabilité</div>
            </div>
          </Link>
          
          {/* Navigation */}
          <nav className="hidden md:flex items-center space-x-8">
            <Link 
              href="#features" 
              className="text-gray-600 hover:text-gray-900 transition-colors"
            >
              Fonctionnalités
            </Link>
            <Link 
              href="#scanner" 
              className="text-gray-600 hover:text-gray-900 transition-colors"
            >
              Scanner
            </Link>
            <a 
              href="https://www.euralis.fr" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-gray-600 hover:text-gray-900 transition-colors"
            >
              À propos
            </a>
          </nav>
          
          {/* CTA */}
          <div className="flex items-center space-x-4">
            <Button variant="outline" size="sm" asChild>
              <Link href="#scanner">
                <QrCode className="w-4 h-4 mr-2" />
                Scanner
              </Link>
            </Button>
            
            {/* Language Toggle */}
            <Button variant="ghost" size="sm">
              <Globe className="w-4 h-4 mr-1" />
              FR
            </Button>
          </div>
        </div>
      </div>
    </header>
  )
}