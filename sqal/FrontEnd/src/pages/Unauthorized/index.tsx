// ============================================================================
// SQAL Frontend - Unauthorized Page
// Page d'erreur pour accès non autorisé
// ============================================================================

import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldAlert } from "lucide-react";

export default function Unauthorized() {
  const navigate = useNavigate();

  return (
    <div className="flex items-center justify-center min-h-screen">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <ShieldAlert className="h-16 w-16 text-red-500" />
          </div>
          <CardTitle>Accès Non Autorisé</CardTitle>
          <CardDescription>
            Vous n'avez pas les permissions nécessaires pour accéder à cette page.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground text-center">
            Veuillez contacter votre administrateur si vous pensez qu'il s'agit d'une erreur.
          </p>
          <Button onClick={() => navigate("/")} className="w-full">
            Retour à l'accueil
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
