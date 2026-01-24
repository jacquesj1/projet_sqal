import React, { useState } from 'react';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Input } from '../ui/input';
import { Download, Loader2, FileText, Database } from 'lucide-react';
import { toast } from 'sonner';

// Types
interface ExportDataButtonProps {
  deviceId?: string;
  className?: string;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

type ExportFormat = 'csv' | 'json';

/**
 * ExportDataButton - Professional data export component for Phase 4
 *
 * Features:
 * - Export to CSV (Excel-compatible) or JSON
 * - Date range filtering
 * - Device filtering
 * - File download trigger
 * - Professional agro-food design
 */
export const ExportDataButton: React.FC<ExportDataButtonProps> = ({
  deviceId,
  className = '',
  variant = 'default',
  size = 'default',
}) => {
  // State
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [format, setFormat] = useState<ExportFormat>('csv');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedDeviceId, setSelectedDeviceId] = useState(deviceId || '');

  // Set default dates (last 7 days)
  React.useEffect(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 7);

    setEndDate(end.toISOString().split('T')[0]);
    setStartDate(start.toISOString().split('T')[0]);
  }, []);

  // Handle export
  const handleExport = async () => {
    if (!startDate || !endDate) {
      toast.error('Veuillez sélectionner une plage de dates');
      return;
    }

    // Validate date range
    if (new Date(startDate) > new Date(endDate)) {
      toast.error('La date de début doit être avant la date de fin');
      return;
    }

    setIsExporting(true);

    try {
      // Build query parameters
      const params = new URLSearchParams({
        format,
        start_date: startDate,
        end_date: endDate,
      });

      if (selectedDeviceId) {
        params.append('device_id', selectedDeviceId);
      }

      // Fetch export data
      const response = await fetch(`/api/export/samples?${params.toString()}`);

      if (!response.ok) {
        throw new Error('Échec de l\'export');
      }

      // Handle file download based on format
      if (format === 'csv') {
        // CSV: Trigger download
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;

        // Extract filename from Content-Disposition header or generate
        const contentDisposition = response.headers.get('Content-Disposition');
        const filename =
          contentDisposition?.split('filename=')[1]?.replace(/"/g, '') ||
          `sqal_export_${new Date().toISOString().split('T')[0]}.csv`;

        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        // JSON: Trigger download
        const data = await response.json();
        const blob = new Blob([JSON.stringify(data, null, 2)], {
          type: 'application/json',
        });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `sqal_export_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }

      toast.success(`Export ${format.toUpperCase()} réussi`);

      setIsDialogOpen(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Erreur lors de l\'export des données'
      );
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        <Button variant={variant} size={size} className={`gap-2 ${className}`}>
          <Download className="h-4 w-4" />
          <span>Exporter</span>
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Exporter les Données</DialogTitle>
          <DialogDescription>
            Télécharger les données d'échantillons dans le format de votre choix
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Format Selection */}
          <div className="space-y-2">
            <Label htmlFor="format">Format de sortie</Label>
            <Select value={format} onValueChange={(v) => setFormat(v as ExportFormat)}>
              <SelectTrigger id="format">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="csv">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    <div>
                      <div className="font-medium">CSV</div>
                      <div className="text-xs text-muted-foreground">
                        Excel, Google Sheets
                      </div>
                    </div>
                  </div>
                </SelectItem>
                <SelectItem value="json">
                  <div className="flex items-center gap-2">
                    <Database className="h-4 w-4" />
                    <div>
                      <div className="font-medium">JSON</div>
                      <div className="text-xs text-muted-foreground">
                        API, Intégration
                      </div>
                    </div>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Date Range */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="start-date">Date de début</Label>
              <Input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end-date">Date de fin</Label>
              <Input
                id="end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          {/* Device ID (optional) */}
          <div className="space-y-2">
            <Label htmlFor="device-id">Device ID (optionnel)</Label>
            <Input
              id="device-id"
              placeholder="Filtrer par device"
              value={selectedDeviceId}
              onChange={(e) => setSelectedDeviceId(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Laisser vide pour exporter tous les devices
            </p>
          </div>

          {/* Info */}
          <div className="rounded-lg border bg-muted/50 p-3 text-sm">
            <p className="font-medium">Informations</p>
            <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
              <li>• Maximum 10,000 échantillons par export</li>
              <li>
                • Le fichier sera téléchargé automatiquement
              </li>
              <li>
                • Format CSV compatible Excel et Google Sheets
              </li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setIsDialogOpen(false)}
            disabled={isExporting}
          >
            Annuler
          </Button>
          <Button onClick={handleExport} disabled={isExporting} className="gap-2">
            {isExporting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Export en cours...
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                Exporter
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
