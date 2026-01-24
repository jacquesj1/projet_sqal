import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Euralis - Pilotage Multi-Sites',
  description: 'Application de pilotage multi-sites pour Euralis',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
