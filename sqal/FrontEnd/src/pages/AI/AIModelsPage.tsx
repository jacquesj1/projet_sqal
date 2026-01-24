// ============================================================================
// AI Models Page
// Gestion des modèles IA (activation, désactivation, métriques)
// ============================================================================

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { AIModelsResponse } from "@/types/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@components/ui/card";
import { Button } from "@components/ui/button";
import { Badge } from "@components/ui/badge";
import api from "@services/api";
import { Play, Square, Download, Trash2, BarChart3 } from "lucide-react";
import { toast } from "sonner";

export function AIModelsPage() {
  const queryClient = useQueryClient();

  const { data: modelsData } = useQuery<AIModelsResponse>({
    queryKey: ["ai", "models"],
    queryFn: () => api.ai.getModels(),
  });

  const activateMutation = useMutation({
    mutationFn: (id: string) => api.ai.activateModel(id),
    onSuccess: () => {
      toast.success("Modèle activé");
      queryClient.invalidateQueries({ queryKey: ["ai", "models"] });
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => api.ai.deactivateModel(id),
    onSuccess: () => {
      toast.success("Modèle désactivé");
      queryClient.invalidateQueries({ queryKey: ["ai", "models"] });
    },
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Gestion des Modèles IA</h1>
        <p className="text-muted-foreground">
          Activez, désactivez et gérez vos modèles de classification
        </p>
      </div>

      {/* Liste des modèles */}
      <div className="grid grid-cols-1 gap-4">
        {modelsData?.models?.map((model: any) => (
          <Card key={model.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>{model.name}</CardTitle>
                  <CardDescription>
                    Type: {model.type} • Version: {model.version || "N/A"}
                  </CardDescription>
                </div>
                <Badge
                  variant={model.status === "active" ? "default" : "secondary"}
                  className={model.status === "active" ? "bg-green-500" : ""}
                >
                  {model.status === "active" ? "Actif" : "Inactif"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Métriques */}
                <div className="grid grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Précision</p>
                    <p className="text-2xl font-bold">
                      {model.accuracy ? (model.accuracy * 100).toFixed(1) : "N/A"}%
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Taille</p>
                    <p className="text-lg font-mono">
                      {model.size ? (model.size / 1024 / 1024).toFixed(1) : "N/A"} MB
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Architecture</p>
                    <p className="text-sm">{model.architecture || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Créé le</p>
                    <p className="text-sm">
                      {model.createdAt
                        ? new Date(model.createdAt).toLocaleDateString("fr-FR")
                        : "N/A"}
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  {model.status === "active" ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => deactivateMutation.mutate(model.id)}
                      disabled={deactivateMutation.isPending}
                    >
                      <Square className="w-4 h-4 mr-2" />
                      Désactiver
                    </Button>
                  ) : (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => activateMutation.mutate(model.id)}
                      disabled={activateMutation.isPending}
                    >
                      <Play className="w-4 h-4 mr-2" />
                      Activer
                    </Button>
                  )}
                  <Button variant="outline" size="sm">
                    <BarChart3 className="w-4 h-4 mr-2" />
                    Métriques
                  </Button>
                  <Button variant="outline" size="sm">
                    <Download className="w-4 h-4 mr-2" />
                    Télécharger
                  </Button>
                  <Button variant="outline" size="sm" className="text-red-500">
                    <Trash2 className="w-4 h-4 mr-2" />
                    Supprimer
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
