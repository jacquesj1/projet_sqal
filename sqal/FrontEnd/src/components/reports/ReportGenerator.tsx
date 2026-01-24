// ============================================================================
// SQAL Frontend - Report Generator Component
// Générateur de rapports PDF/Excel
// ============================================================================

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Download } from "lucide-react";

interface ReportGeneratorProps {
  reportType: "quality" | "analysis" | "audit";
  title: string;
  description: string;
}

export function ReportGenerator({ reportType, title, description }: ReportGeneratorProps) {
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      // TODO: Implémenter la génération de rapport via API
      console.log(`Generating ${reportType} report...`);
      await new Promise((resolve) => setTimeout(resolve, 2000)); // Simulation
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Button
          onClick={handleGenerate}
          disabled={isGenerating}
          className="w-full"
        >
          <Download className="h-4 w-4 mr-2" />
          {isGenerating ? "Génération en cours..." : "Générer le rapport"}
        </Button>
      </CardContent>
    </Card>
  );
}
