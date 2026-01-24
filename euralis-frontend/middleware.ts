import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Routes qui nécessitent une authentification
const protectedRoutes = [
  '/euralis/dashboard',
  '/euralis/sites',
  '/euralis/gaveurs',
  '/euralis/previsions',
  '/euralis/qualite',
  '/euralis/abattages',
  '/euralis/finance',
  '/euralis/production',
  '/euralis/analytics',
];

// Routes publiques (authentification)
const authRoutes = ['/login'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Vérifier si l'utilisateur est connecté (via cookie ou localStorage simulé)
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
    return NextResponse.redirect(new URL('/euralis/dashboard', request.url));
  }

  return NextResponse.next();
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
