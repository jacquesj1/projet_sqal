// ============================================================================
// Admin Audit Page
// Logs d'audit et traçabilité des actions
// ============================================================================

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { AuditLogsResponse } from "@/types/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@components/ui/card";
import { Badge } from "@components/ui/badge";
import { Button } from "@components/ui/button";
import { Input } from "@components/ui/input";
import api from "@services/api";
import { Search, Download, FileText } from "lucide-react";

export function AdminAuditPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [actionFilter, setActionFilter] = useState<string | null>(null);

  const { data: auditData } = useQuery<AuditLogsResponse>({
    queryKey: ["admin", "audit", actionFilter],
    queryFn: () =>
      api.admin.getAuditLogs({
        limit: 50,
        action: actionFilter || undefined,
      }),
    refetchInterval: 10000,
  });

  const actions = ["create", "update", "delete", "login", "logout"];

  const getActionBadge = (action: string) => {
    const colors: Record<string, string> = {
      create: "bg-green-500",
      update: "bg-blue-500",
      delete: "bg-red-500",
      login: "bg-purple-500",
      logout: "bg-gray-500",
    };

    return (
      <Badge className={colors[action] || "bg-gray-500"}>
        {action.toUpperCase()}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Logs d'Audit</h1>
        <p className="text-muted-foreground">
          Traçabilité complète des actions système
        </p>
      </div>

      {/* Filtres */}
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
                  placeholder="Rechercher dans les logs..."
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
              variant={actionFilter === null ? "default" : "outline"}
              size="sm"
              onClick={() => setActionFilter(null)}
            >
              Toutes
            </Button>
            {actions.map((action) => (
              <Button
                key={action}
                variant={actionFilter === action ? "default" : "outline"}
                size="sm"
                onClick={() => setActionFilter(action)}
              >
                {action}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Liste des logs */}
      <Card>
        <CardHeader>
          <CardTitle>Historique des Actions</CardTitle>
          <CardDescription>
            {auditData?.logs?.length || 0} entrée(s) trouvée(s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {auditData?.logs?.map((log: any) => (
              <div
                key={log.id}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent"
              >
                <div className="flex items-center gap-4">
                  <FileText className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <div className="flex items-center gap-2">
                      {getActionBadge(log.action)}
                      <p className="font-medium">{log.userName}</p>
                      <span className="text-sm text-muted-foreground">
                        {log.action} {log.resourceType}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {new Date(log.timestamp).toLocaleString("fr-FR")} •{" "}
                      IP: {log.ipAddress || "N/A"}
                    </p>
                    {log.details && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {log.details}
                      </p>
                    )}
                  </div>
                </div>

                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Resource ID</p>
                  <p className="font-mono text-sm">{log.resourceId}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
