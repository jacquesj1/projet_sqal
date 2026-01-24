// ============================================================================
// Reports Page
// Génération et gestion des rapports
// ============================================================================

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { ReportsResponse } from "@/types/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@components/ui/card";
import { Button } from "@components/ui/button";
import { Input } from "@components/ui/input";
import { Label } from "@components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@components/ui/tabs";
import { Badge } from "@components/ui/badge";
import api from "@services/api";
import { FileText, Download, Clock, CheckCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

export function ReportsPage() {
  const queryClient = useQueryClient();
  const [reportType, setReportType] = useState("daily");
  const [reportFormat, setReportFormat] = useState("pdf");
  const [reportTitle, setReportTitle] = useState("");

  const { data: reportsData } = useQuery<ReportsResponse>({
    queryKey: ["reports"],
    queryFn: () => api.reports.getReports({ limit: 20 }),
    refetchInterval: 10000,
  });

  const generateMutation = useMutation({
    mutationFn: (params: any) => api.reports.createReport(params),
    onSuccess: () => {
      toast.success("Génération du rapport démarrée");
      queryClient.invalidateQueries({ queryKey: ["reports"] });
    },
    onError: () => {
      toast.error("Erreur lors de la génération du rapport");
    },
  });

  const handleGenerateReport = () => {
    generateMutation.mutate({
      report_type: reportType,
      title: reportTitle || `Rapport ${reportType}`,
      format: reportFormat,
      start_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      end_date: new Date().toISOString(),
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="secondary">En attente</Badge>;
      case "generating":
        return <Badge className="bg-blue-500">Génération...</Badge>;
      case "completed":
        return <Badge className="bg-green-500">Terminé</Badge>;
      case "failed":
        return <Badge variant="destructive">Échoué</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return <Clock className="w-4 h-4 text-yellow-500" />;
      case "generating":
        return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
      case "completed":
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      default:
        return <FileText className="w-4 h-4 text-gray-500" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Rapports</h1>
        <p className="text-muted-foreground">
          Générez et consultez vos rapports d'analyse
        </p>
      </div>

      <Tabs defaultValue="generate">
        <TabsList>
          <TabsTrigger value="generate">Nouveau Rapport</TabsTrigger>
          <TabsTrigger value="list">Mes Rapports</TabsTrigger>
          <TabsTrigger value="scheduled">Rapports Planifiés</TabsTrigger>
        </TabsList>

        {/* Génération de rapport */}
        <TabsContent value="generate" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Générer un Nouveau Rapport</CardTitle>
              <CardDescription>
                Configurez les paramètres de votre rapport
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="report-type">Type de Rapport</Label>
                  <Select value={reportType} onValueChange={setReportType}>
                    <SelectTrigger id="report-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Quotidien</SelectItem>
                      <SelectItem value="weekly">Hebdomadaire</SelectItem>
                      <SelectItem value="monthly">Mensuel</SelectItem>
                      <SelectItem value="quality">Qualité</SelectItem>
                      <SelectItem value="traceability">Traçabilité</SelectItem>
                      <SelectItem value="custom">Personnalisé</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="report-format">Format</Label>
                  <Select value={reportFormat} onValueChange={setReportFormat}>
                    <SelectTrigger id="report-format">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pdf">PDF</SelectItem>
                      <SelectItem value="excel">Excel</SelectItem>
                      <SelectItem value="csv">CSV</SelectItem>
                      <SelectItem value="json">JSON</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="col-span-2 space-y-2">
                  <Label htmlFor="report-title">Titre du Rapport</Label>
                  <Input
                    id="report-title"
                    placeholder="Ex: Rapport Qualité Semaine 42"
                    value={reportTitle}
                    onChange={(e) => setReportTitle(e.target.value)}
                  />
                </div>
              </div>

              <Button
                onClick={handleGenerateReport}
                disabled={generateMutation.isPending}
                className="w-full"
              >
                {generateMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Génération en cours...
                  </>
                ) : (
                  <>
                    <FileText className="w-4 h-4 mr-2" />
                    Générer le Rapport
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Liste des rapports */}
        <TabsContent value="list" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Mes Rapports ({reportsData?.total || 0})</CardTitle>
              <CardDescription>Historique de vos rapports générés</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {reportsData?.reports?.map((report: any) => (
                  <div
                    key={report.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent"
                  >
                    <div className="flex items-center gap-4">
                      {getStatusIcon(report.status)}
                      <div>
                        <p className="font-medium">{report.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {report.reportType} • {report.format.toUpperCase()} •{" "}
                          {new Date(report.createdAt).toLocaleDateString("fr-FR")}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      {getStatusBadge(report.status)}
                      {report.status === "completed" && (
                        <Button size="sm" variant="outline">
                          <Download className="w-4 h-4 mr-2" />
                          Télécharger
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Rapports planifiés */}
        <TabsContent value="scheduled">
          <Card>
            <CardHeader>
              <CardTitle>Rapports Planifiés</CardTitle>
              <CardDescription>
                Configurez des rapports automatiques récurrents
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Fonctionnalité de planification à venir...
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
