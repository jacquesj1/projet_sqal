import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, AlertCircle, Info } from "lucide-react";

interface AlertItem {
  type: string;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  count?: number;
  value?: number;
}

export function FoieGrasAlerts() {
  const { data, isLoading } = useQuery<AlertItem[]>({
    queryKey: ['foie-gras-alerts'],
    queryFn: async () => {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'}/api/sqal/alerts`);
      if (!response.ok) throw new Error('Failed to fetch alerts');
      return response.json();
    },
    refetchInterval: 5000,
  });

  if (isLoading || !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Alertes Temps Réel</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-2">
            <div className="h-12 bg-gray-200 rounded"></div>
            <div className="h-12 bg-gray-200 rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <AlertTriangle className="h-5 w-5 text-red-500" />;
      case 'warning':
        return <AlertCircle className="h-5 w-5 text-yellow-500" />;
      case 'info':
        return <Info className="h-5 w-5 text-blue-500" />;
      default:
        return <Info className="h-5 w-5" />;
    }
  };

  const getSeverityClass = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'border-red-500 bg-red-50';
      case 'warning':
        return 'border-yellow-500 bg-yellow-50';
      case 'info':
        return 'border-blue-500 bg-blue-50';
      default:
        return '';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          Alertes & Actions
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Info className="h-12 w-12 mx-auto mb-2 text-green-500" />
            <p className="font-medium text-green-600">Aucune alerte active</p>
            <p className="text-sm">Tous les paramètres sont dans les normes</p>
          </div>
        ) : (
          <div className="space-y-3">
            {data.slice(0, 10).map((alert, index) => (
              <Alert
                key={index}
                className={getSeverityClass(alert.severity)}
              >
                <div className="flex items-start gap-3">
                  {getSeverityIcon(alert.severity)}
                  <div className="flex-1">
                    <AlertDescription className="font-medium">
                      {alert.message}
                    </AlertDescription>
                    {alert.count && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {alert.count} occurrence{alert.count > 1 ? 's' : ''} détectée{alert.count > 1 ? 's' : ''}
                      </p>
                    )}
                  </div>
                </div>
              </Alert>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
