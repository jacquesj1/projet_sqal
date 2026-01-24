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

  // Générer les breadcrumbs à partir du pathname
  const generateBreadcrumbs = (): BreadcrumbItem[] => {
    const paths = pathname.split('/').filter(Boolean);
    const breadcrumbs: BreadcrumbItem[] = [];

    // Toujours commencer par Home
    breadcrumbs.push({ label: 'Accueil', href: '/euralis/dashboard' });

    // Mapper les segments de path en labels lisibles
    const pathLabels: { [key: string]: string } = {
      euralis: 'Euralis',
      dashboard: 'Dashboard',
      analytics: 'Analytics',
      sites: 'Sites',
      gaveurs: 'Gaveurs',
      courbes: 'Courbes PySR',
      previsions: 'Prévisions',
      qualite: 'Qualité',
      abattages: 'Abattages',
      finance: 'Finance',
      production: 'Production',
      LL: 'Bretagne (LL)',
      LS: 'Pays de Loire (LS)',
      MT: 'Maubourguet (MT)',
    };

    let currentPath = '';
    paths.forEach((segment, index) => {
      currentPath += `/${segment}`;

      // Ne pas ajouter 'euralis' seul dans le breadcrumb
      if (segment === 'euralis') return;

      const label = pathLabels[segment] || segment;
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
  if (pathname === '/euralis/dashboard' || pathname === '/euralis') {
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
