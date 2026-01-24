// ============================================================================
// SQAL Frontend - Login Page
// Keycloak SSO Authentication
// ============================================================================

import { useAuthStore } from "@stores/authStore";
import { Button } from "@components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@components/ui/card";
import { LogIn, Shield } from "lucide-react";

export function Login() {
  const { login } = useAuthStore();

  // TEMPORAIRE : Désactivé pour débogage
  // useEffect(() => {
  //   // Redirect to dashboard if already authenticated
  //   if (isAuthenticated) {
  //     navigate("/");
  //   }
  // }, [isAuthenticated, navigate]);

  const handleLogin = async () => {
    try {
      await login();
    } catch (error) {
      console.error("Login failed:", error);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-primary/10 rounded-full">
              <Shield className="h-12 w-12 text-primary" />
            </div>
          </div>
          <CardTitle className="text-3xl font-bold">SQAL</CardTitle>
          <CardDescription className="text-base">
            Système de Qualification Alimentaire
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <Button
              onClick={handleLogin}
              className="w-full h-12 text-lg"
              size="lg"
            >
              <LogIn className="mr-2 h-5 w-5" />
              Se connecter avec Keycloak
            </Button>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                Authentification sécurisée SSO
              </span>
            </div>
          </div>

          <div className="space-y-2 text-center text-sm text-muted-foreground">
            <p>
              Utilisez vos identifiants Keycloak pour accéder au système.
            </p>
            <p className="text-xs">
              Besoin d'aide ? Contactez votre administrateur système.
            </p>
          </div>

          <div className="pt-4 border-t">
            <div className="grid grid-cols-3 gap-4 text-center text-xs text-muted-foreground">
              <div>
                <div className="font-semibold text-foreground">Temps Réel</div>
                <div>Analyse instantanée</div>
              </div>
              <div>
                <div className="font-semibold text-foreground">IA Avancée</div>
                <div>Modèles ML/CNN</div>
              </div>
              <div>
                <div className="font-semibold text-foreground">Sécurisé</div>
                <div>SSO Keycloak</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Footer */}
      <div className="absolute bottom-4 text-center text-sm text-muted-foreground">
        <p>© 2025 SQAL - Tous droits réservés</p>
      </div>
    </div>
  );
}
