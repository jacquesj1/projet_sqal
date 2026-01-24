'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight, Home } from 'lucide-react';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

export default function Breadcrumb() {
  const pathname = usePathname();

  const generateBreadcrumbs = (): BreadcrumbItem[] => {
    const paths = pathname.split('/').filter(Boolean);
    const breadcrumbs: BreadcrumbItem[] = [];

    // Toujours commencer par Home
    breadcrumbs.push({ label: 'Accueil', href: '/' });

    // Mapper les segments de path en labels lisibles
    const pathLabels: { [key: string]: string } = {
      lots: 'Mes Lots',
      analytics: 'Analytics',
      historique: 'Historique',
      blockchain: 'Traçabilité',
      qualite: 'Qualité',
      profil: 'Mon Profil',
    };

    let currentPath = '';
    paths.forEach((segment, index) => {
      currentPath += `/${segment}`;

      // Si c'est un ID numérique, on le traite différemment
      if (/^\d+$/.test(segment)) {
        breadcrumbs.push({
          label: `#${segment}`,
          href: undefined, // Dernier élément, pas de lien
        });
        return;
      }

      const label = pathLabels[segment] || segment.charAt(0).toUpperCase() + segment.slice(1);
      const isLast = index === paths.length - 1;

      breadcrumbs.push({
        label,
        href: isLast ? undefined : currentPath,
      });
    });

    return breadcrumbs;
  };

  const breadcrumbs = generateBreadcrumbs();

  // Ne pas afficher si on est sur la page d'accueil
  if (pathname === '/') {
    return null;
  }

  return (
    <nav className="flex items-center space-x-2 text-sm text-gray-600 mb-6">
      {breadcrumbs.map((crumb, index) => (
        <div key={index} className="flex items-center">
          {index > 0 && <ChevronRight className="mx-2 h-4 w-4 text-gray-400" />}

          {crumb.href ? (
            <Link
              href={crumb.href}
              className="hover:text-blue-600 transition-colors flex items-center gap-1"
            >
              {index === 0 && <Home className="h-4 w-4" />}
              {crumb.label}
            </Link>
          ) : (
            <span className="text-gray-900 font-medium flex items-center gap-1">
              {index === 0 && <Home className="h-4 w-4" />}
              {crumb.label}
            </span>
          )}
        </div>
      ))}
    </nav>
  );
}
