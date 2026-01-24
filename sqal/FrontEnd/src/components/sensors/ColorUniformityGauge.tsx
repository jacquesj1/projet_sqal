import { Card, CardContent, CardHeader, CardTitle } from "@components/ui/card";
import { Badge } from "@components/ui/badge";
import { Palette } from "lucide-react";

interface ColorUniformityGaugeProps {
  value: number; // 0-1
  label?: string;
}

export default function ColorUniformityGauge({ value, label = "Uniformité couleur" }: ColorUniformityGaugeProps) {
  const percentage = value * 100;

  const getStatus = (val: number) => {
    if (val > 85) return { label: "Excellent", color: "bg-blue-600", variant: "default" as const };
    if (val > 70) return { label: "Bon", color: "bg-blue-500", variant: "default" as const };
    if (val > 50) return { label: "Acceptable", color: "bg-yellow-500", variant: "secondary" as const };
    if (val > 30) return { label: "Faible", color: "bg-orange-500", variant: "outline" as const };
    return { label: "Critique", color: "bg-red-600", variant: "destructive" as const };
  };

  const status = getStatus(percentage);

  // Arc SVG
  const radius = 70;
  const strokeWidth = 12;
  const circumference = Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <Palette className="h-4 w-4 text-blue-600" />
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center justify-center space-y-3">
          <div className="relative">
            <svg width="160" height="100" className="transform -rotate-90">
              <path
                d={`M 20 80 A ${radius} ${radius} 0 0 1 140 80`}
                fill="none"
                stroke="#e5e7eb"
                strokeWidth={strokeWidth}
                strokeLinecap="round"
              />
              <path
                d={`M 20 80 A ${radius} ${radius} 0 0 1 140 80`}
                fill="none"
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                className="transition-all duration-500"
                style={{
                  stroke:
                    status.color === "bg-blue-600"
                      ? "#2563eb"
                      : status.color === "bg-blue-500"
                        ? "#3b82f6"
                        : status.color === "bg-yellow-500"
                          ? "#eab308"
                          : status.color === "bg-orange-500"
                            ? "#f97316"
                            : "#dc2626",
                }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center mt-6">
                <div className="text-3xl font-bold">{percentage.toFixed(0)}</div>
                <div className="text-xs text-muted-foreground">/ 100</div>
              </div>
            </div>
          </div>

          <Badge variant={status.variant} className="text-sm">
            {status.label}
          </Badge>

          <div className="text-xs text-muted-foreground text-center">Indice d'uniformité de la couleur</div>
        </div>
      </CardContent>
    </Card>
  );
}
