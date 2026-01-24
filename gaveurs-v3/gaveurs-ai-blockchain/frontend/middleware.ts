import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Routes qui nécessitent une authentification
const protectedRoutes = [
  '/',
  '/gavage',
  '/canards',
  '/analytics',
  '/blockchain',
  '/alertes',
  '/environnement',
  '/veterinaires',
  '/certifications',
  '/photos',
  '/scan',
  '/simulations',
];

// Routes publiques (authentification)
const authRoutes = ['/login', '/register', '/forgot-password'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // DÉMO MODE: Désactiver l'authentification pour la démonstration
  // Pour réactiver: Commenter la ligne ci-dessous et décommenter le reste
  return NextResponse.next();

  /* AUTHENTIFICATION DÉSACTIVÉE POUR DÉMO
  // Vérifier si l'utilisateur est connecté (via cookie ou header)
  // Note: localStorage n'est pas accessible côté serveur, donc on utilise un cookie
  const authToken = request.cookies.get('access_token')?.value;
  const isAuthenticated = !!authToken;

  // Rediriger les utilisateurs non connectés vers login
  const isProtectedRoute = protectedRoutes.some((route) =>
    pathname === route || pathname.startsWith(route + '/')
  );

  if (isProtectedRoute && !isAuthenticated) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Rediriger les utilisateurs connectés loin des pages d'auth
  const isAuthRoute = authRoutes.some((route) => pathname.startsWith(route));

  if (isAuthRoute && isAuthenticated) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
  */
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!api|_next/static|_next/image|favicon.ico|public).*)',
  ],
};
