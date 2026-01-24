/**
 * Protected Route Component
 * Restricts access based on authentication and roles
 */

import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: string;
  requiredRoles?: string[];
  minimumRole?: string;
  fallbackPath?: string;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredRole,
  requiredRoles,
  minimumRole,
  fallbackPath = '/unauthorized',
}) => {
  const { isAuthenticated, isLoading, hasRole, hasAnyRole, hasMinimumRole, login, keycloakEnabled } = useAuth();

  // Show loading spinner while checking authentication
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Vérification de l'authentification...</p>
        </div>
      </div>
    );
  }

  // If Keycloak is disabled, allow access (development mode)
  if (!keycloakEnabled) {
    console.warn('Keycloak disabled - allowing access without authentication');
    return <>{children}</>;
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    login();
    return null;
  }

  // Check role-based access
  let hasAccess = true;

  if (requiredRole && !hasRole(requiredRole)) {
    hasAccess = false;
  }

  if (requiredRoles && !hasAnyRole(requiredRoles)) {
    hasAccess = false;
  }

  if (minimumRole && !hasMinimumRole(minimumRole)) {
    hasAccess = false;
  }

  // Redirect to fallback if no access
  if (!hasAccess) {
    return <Navigate to={fallbackPath} replace />;
  }

  return <>{children}</>;
};

// Unauthorized page component
export const UnauthorizedPage: React.FC = () => {
  const { user, logout } = useAuth();

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-red-50 to-orange-50">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
        <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg
            className="w-10 h-10 text-red-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
        
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Accès Refusé</h1>
        <p className="text-gray-600 mb-6">
          Vous n'avez pas les permissions nécessaires pour accéder à cette page.
        </p>
        
        {user && (
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <p className="text-sm text-gray-600 mb-1">Connecté en tant que :</p>
            <p className="font-semibold text-gray-900">{user.email}</p>
            <p className="text-sm text-gray-500 mt-2">
              Rôle actuel : <span className="font-medium">{user.highestRole || 'Aucun'}</span>
            </p>
          </div>
        )}
        
        <div className="space-y-3">
          <button
            onClick={() => window.history.back()}
            className="w-full px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors font-medium"
          >
            Retour
          </button>
          <button
            onClick={logout}
            className="w-full px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
          >
            Se déconnecter
          </button>
        </div>
      </div>
    </div>
  );
};
