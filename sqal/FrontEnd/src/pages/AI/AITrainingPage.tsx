// ============================================================================
// AI Training Page
// Entraînement et gestion des modèles IA
// ============================================================================

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { TrainingHistoryResponse } from "@/types/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@components/ui/card";
import { Button } from "@components/ui/button";
import { Input } from "@components/ui/input";
import { Label } from "@components/ui/label";
import { Badge } from "@components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@components/ui/select";
import api from "@services/api";
import { Play, Clock, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

export function AITrainingPage() {
  const queryClient = useQueryClient();
  const [modelType, setModelType] = useState("vl53l8ch_cnn");
  const [epochs, setEpochs] = useState(50);
  const [batchSize, setBatchSize] = useState(32);
  const [learningRate, setLearningRate] = useState(0.001);

  const { data: trainingHistory } = useQuery<TrainingHistoryResponse>({
    queryKey: ["ai", "training-history"],
    queryFn: () => api.ai.getTrainingJobs({ limit: 10 }),
    refetchInterval: 5000,
  });

  const trainMutation = useMutation({
    mutationFn: (params: any) => api.ai.createTrainingJob(params),
    onSuccess: () => {
      toast.success("Entraînement démarré avec succès");
      queryClient.invalidateQueries({ queryKey: ["ai", "training-history"] });
    },
    onError: () => {
      toast.error("Erreur lors du démarrage de l'entraînement");
    },
  });

  const handleStartTraining = () => {
    trainMutation.mutate({
      model_type: modelType,
      epochs,
      batch_size: batchSize,
      learning_rate: learningRate,
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return <Clock className="w-4 h-4 text-yellow-500" />;
      case "running":
        return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
      case "completed":
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case "failed":
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="secondary">En attente</Badge>;
      case "running":
        return <Badge className="bg-blue-500">En cours</Badge>;
      case "completed":
        return <Badge className="bg-green-500">Terminé</Badge>;
      case "failed":
        return <Badge variant="destructive">Échoué</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Entraînement IA</h1>
        <p className="text-muted-foreground">
          Entraînez et optimisez vos modèles de classification
        </p>
      </div>

      {/* Configuration d'entraînement */}
      <Card>
        <CardHeader>
          <CardTitle>Nouveau Training</CardTitle>
          <CardDescription>
            Configurez les paramètres d'entraînement
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="model-type">Type de Modèle</Label>
              <Select value={modelType} onValueChange={setModelType}>
                <SelectTrigger id="model-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="vl53l8ch_cnn">VL53L8CH CNN</SelectItem>
                  <SelectItem value="as7341_cnn">AS7341 CNN</SelectItem>
                  <SelectItem value="fusion_ensemble">Fusion Ensemble</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="epochs">Nombre d'Époques</Label>
              <Input
                id="epochs"
                type="number"
                value={epochs}
                onChange={(e) => setEpochs(parseInt(e.target.value))}
                min={1}
                max={200}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="batch-size">Taille de Batch</Label>
              <Input
                id="batch-size"
                type="number"
                value={batchSize}
                onChange={(e) => setBatchSize(parseInt(e.target.value))}
                min={8}
                max={128}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="learning-rate">Taux d'Apprentissage</Label>
              <Input
                id="learning-rate"
                type="number"
                step="0.0001"
                value={learningRate}
                onChange={(e) => setLearningRate(parseFloat(e.target.value))}
                min={0.0001}
                max={0.1}
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleStartTraining}
              disabled={trainMutation.isPending}
            >
              {trainMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Démarrage...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Démarrer l'Entraînement
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Historique des entraînements */}
      <Card>
        <CardHeader>
          <CardTitle>Historique des Entraînements</CardTitle>
          <CardDescription>
            {trainingHistory?.total || 0} entraînement(s) au total
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {trainingHistory?.trainings?.map((training: any) => (
              <div
                key={training.id}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div className="flex items-center gap-4">
                  {getStatusIcon(training.status)}
                  <div>
                    <p className="font-medium">
                      Training #{training.id} - {training.modelType}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Démarré le {new Date(training.startedAt).toLocaleString("fr-FR")}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Époques</p>
                    <p className="font-mono">
                      {training.currentEpoch || 0}/{training.totalEpochs}
                    </p>
                  </div>
                  {training.accuracy && (
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Précision</p>
                      <p className="font-bold text-green-500">
                        {(training.accuracy * 100).toFixed(1)}%
                      </p>
                    </div>
                  )}
                  {getStatusBadge(training.status)}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
