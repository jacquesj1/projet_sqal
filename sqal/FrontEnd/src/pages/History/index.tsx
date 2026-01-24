// ============================================================================
// SQAL Frontend - History Page
// Historique des analyses et recherche
// ============================================================================

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function History() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Historique</h1>
        <p className="text-muted-foreground">
          Recherche et consultation des analyses passées
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recherche d'Analyses</CardTitle>
          <CardDescription>
            Filtrez par date, grade, échantillon ou device
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Interface de recherche et tableau des résultats
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
