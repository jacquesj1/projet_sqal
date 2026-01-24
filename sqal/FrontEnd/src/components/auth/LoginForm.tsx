// ============================================================================
// SQAL Frontend - Login Form Component
// Formulaire de connexion avec Keycloak
// ============================================================================

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuthStore } from "@/stores/authStore";

export function LoginForm() {
  const { login } = useAuthStore();

  const handleLogin = () => {
    login();
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Connexion SQAL</CardTitle>
        <CardDescription>
          Système de Contrôle Qualité Alimentaire
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button onClick={handleLogin} className="w-full">
          Se connecter avec Keycloak
        </Button>
      </CardContent>
    </Card>
  );
}
