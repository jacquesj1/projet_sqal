// ============================================================================
// ExportButton Component
// Bouton d'export de données avec menu déroulant
// ============================================================================

import { useState } from 'react';
import { Button } from '@components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@components/ui/dropdown-menu';
import { Download, FileText, FileSpreadsheet, FileJson } from 'lucide-react';
import { toast } from 'sonner';

export type ExportFormat = 'csv' | 'excel' | 'json' | 'pdf';

interface ExportButtonProps {
  onExport: (format: ExportFormat) => Promise<void> | void;
  formats?: ExportFormat[];
  disabled?: boolean;
  label?: string;
}

const formatIcons: Record<ExportFormat, React.ReactNode> = {
  csv: <FileText className="w-4 h-4 mr-2" />,
  excel: <FileSpreadsheet className="w-4 h-4 mr-2" />,
  json: <FileJson className="w-4 h-4 mr-2" />,
  pdf: <FileText className="w-4 h-4 mr-2" />,
};

const formatLabels: Record<ExportFormat, string> = {
  csv: 'Exporter en CSV',
  excel: 'Exporter en Excel',
  json: 'Exporter en JSON',
  pdf: 'Exporter en PDF',
};

export function ExportButton({
  onExport,
  formats = ['csv', 'excel', 'json', 'pdf'],
  disabled = false,
  label = 'Exporter',
}: ExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async (format: ExportFormat) => {
    setIsExporting(true);
    try {
      await onExport(format);
      toast.success(`Export ${format.toUpperCase()} réussi`);
    } catch (error) {
      console.error('Export error:', error);
      toast.error(`Erreur lors de l'export ${format.toUpperCase()}`);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" disabled={disabled || isExporting}>
          <Download className="w-4 h-4 mr-2" />
          {isExporting ? 'Export en cours...' : label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {formats.map((format) => (
          <DropdownMenuItem
            key={format}
            onClick={() => handleExport(format)}
            disabled={isExporting}
          >
            {formatIcons[format]}
            {formatLabels[format]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
