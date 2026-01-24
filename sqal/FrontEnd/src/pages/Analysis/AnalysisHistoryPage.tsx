// ============================================================================
// Analysis History Page
// Historique complet des analyses avec filtres et pagination
// ============================================================================

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { AnalysisHistoryResponse } from "@/types/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@components/ui/card";
import { Badge } from "@components/ui/badge";
import { Button } from "@components/ui/button";
import { Input } from "@components/ui/input";
import api from "@services/api";
import { Search, Download, ChevronLeft, ChevronRight } from "lucide-react";

export function AnalysisHistoryPage() {
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [gradeFilter, setGradeFilter] = useState<string | null>(null);

  const { data: historyData, isLoading } = useQuery<AnalysisHistoryResponse>({
    queryKey: ["analysis", "history", page, gradeFilter],
    queryFn: () =>
      api.analysis.getHistory({
        page,
        page_size: 20,
        grade: gradeFilter || undefined,
      }),
  });

  const grades = ["A+", "A", "B", "C", "REJECT"];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Historique des Analyses</h1>
        <p className="text-muted-foreground">
          Consultez et exportez l'historique complet des analyses
        </p>
      </div>

      {/* Filtres et recherche */}
      <Card>
        <CardHeader>
          <CardTitle>Filtres</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher par ID échantillon..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Button variant="outline">
              <Download className="w-4 h-4 mr-2" />
              Exporter
            </Button>
          </div>

          <div className="flex gap-2">
            <Button
              variant={gradeFilter === null ? "default" : "outline"}
              size="sm"
              onClick={() => setGradeFilter(null)}
            >
              Tous
            </Button>
            {grades.map((grade) => (
              <Button
                key={grade}
                variant={gradeFilter === grade ? "default" : "outline"}
                size="sm"
                onClick={() => setGradeFilter(grade)}
              >
                {grade}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Liste des analyses */}
      <Card>
        <CardHeader>
          <CardTitle>
            Résultats ({historyData?.pagination?.totalItems || 0})
          </CardTitle>
          <CardDescription>
            Page {page} sur {historyData?.pagination?.totalPages || 1}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-20 bg-gray-100 rounded animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {historyData?.analyses?.map((analysis: any) => (
                <div
                  key={analysis.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent cursor-pointer transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <Badge
                        className={
                          analysis.grade === "A+" || analysis.grade === "A"
                            ? "bg-green-500"
                            : analysis.grade === "B"
                            ? "bg-yellow-500"
                            : "bg-red-500"
                        }
                      >
                        {analysis.grade}
                      </Badge>
                      <div>
                        <p className="font-medium">{analysis.id}</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(analysis.time).toLocaleString("fr-FR")}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-8">
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Score Qualité</p>
                      <p className="text-lg font-bold">
                        {(analysis.qualityScore * 100).toFixed(1)}%
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Défauts</p>
                      <p className="text-lg font-bold text-red-500">
                        {analysis.numDefects || 0}
                      </p>
                    </div>
                    {analysis.lotAbattage && (
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">Lot</p>
                        <p className="text-sm font-mono">{analysis.lotAbattage}</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          <div className="flex items-center justify-between mt-6">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={!historyData?.pagination?.hasPrevious}
            >
              <ChevronLeft className="w-4 h-4 mr-2" />
              Précédent
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {page} sur {historyData?.pagination?.totalPages || 1}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => p + 1)}
              disabled={!historyData?.pagination?.hasNext}
            >
              Suivant
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
