import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import '@/styles/globals.css';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { AuthProvider } from '@/context/AuthContext';
import { WebSocketProvider } from '@/context/WebSocketContext';
import { ToastProvider } from '@/components/ui/Toast';
import ConnectionStatus from '@/components/layout/ConnectionStatus';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Système Gaveurs V2.1 - Traçabilité & IA',
  description: 'Système intelligent de gestion du gavage avec blockchain et intelligence artificielle',
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body className={`${inter.className} min-h-screen flex flex-col bg-gray-50`}>
        <AuthProvider>
          <WebSocketProvider>
            <ToastProvider>
              <Navbar />
              <main className="flex-1">
                {children}
              </main>
              <Footer />
              <ConnectionStatus />
            </ToastProvider>
          </WebSocketProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
