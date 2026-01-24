import './globals.css'
import type { Metadata } from 'next'
import { Inter, Poppins } from 'next/font/google'

import { Providers } from '@/components/providers/providers'
import { Header } from '@/components/layout/header'
import { Footer } from '@/components/layout/footer'

const inter = Inter({ 
  subsets: ['latin'],
  variable: '--font-inter',
})

const poppins = Poppins({ 
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-poppins',
})

export const metadata: Metadata = {
  title: {
    default: 'Traçabilité Euralis - Vérifiez l\'origine de vos produits',
    template: '%s | Traçabilité Euralis'
  },
  description: 'Découvrez l\'origine et la qualité de vos produits Euralis grâce à la traçabilité blockchain. Scannez le QR code pour accéder aux informations complètes.',
  keywords: ['traçabilité', 'euralis', 'qualité', 'origine', 'blockchain', 'foie gras', 'gavage', 'canard'],
  authors: [{ name: 'Euralis', url: 'https://www.euralis.fr' }],
  creator: 'A Deep Adventure',
  publisher: 'Euralis',
  openGraph: {
    type: 'website',
    locale: 'fr_FR',
    url: 'https://trace.euralis.fr',
    title: 'Traçabilité Euralis',
    description: 'Vérifiez l\'origine et la qualité de vos produits Euralis',
    siteName: 'Traçabilité Euralis',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Traçabilité Euralis',
    description: 'Vérifiez l\'origine et la qualité de vos produits Euralis',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon-16x16.png',
    apple: '/apple-touch-icon.png',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr" className={`${inter.variable} ${poppins.variable}`}>
      <body className="min-h-screen bg-gray-50 flex flex-col">
        <Providers>
          <Header />
          <main className="flex-1">
            {children}
          </main>
          <Footer />
        </Providers>
      </body>
    </html>
  )
}