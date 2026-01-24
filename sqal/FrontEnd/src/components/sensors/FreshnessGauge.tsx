import { Card, CardContent, CardHeader, CardTitle } from "@components/ui/card";
import { Badge } from "@components/ui/badge";
import { Leaf } from "lucide-react";

interface FreshnessGaugeProps {
  value: number; // 0-1
  label?: string;
}

export default function FreshnessGauge({ value, label = "Freshness Index" }: FreshnessGaugeProps) {
  const percentage = value * 100;

  const getStatus = (val: number) => {
    if (val > 85) return { label: "Excellent", color: "bg-green-600", variant: "default" as const };
    if (val > 70) return { label: "Good", color: "bg-green-500", variant: "default" as const };
    if (val > 50) return { label: "Acceptable", color: "bg-yellow-500", variant: "secondary" as const };
    if (val > 30) return { label: "Low", color: "bg-orange-500", variant: "outline" as const };
    return { label: "Critical", color: "bg-red-600", variant: "destructive" as const };
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
          <Leaf className="h-4 w-4 text-green-600" />
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center justify-center space-y-3">
          {/* Gauge SVG */}
          <div className="relative">
            <svg width="160" height="100" className="transform -rotate-90">
              {/* Background arc */}
              <path
                d={`M 20 80 A ${radius} ${radius} 0 0 1 140 80`}
                fill="none"
                stroke="#e5e7eb"
                strokeWidth={strokeWidth}
                strokeLinecap="round"
              />
              {/* Value arc */}
              <path
                d={`M 20 80 A ${radius} ${radius} 0 0 1 140 80`}
                fill="none"
                stroke={status.color.replace("bg-", "#")}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                className="transition-all duration-500"
                style={{
                  stroke: status.color === "bg-green-600" ? "#16a34a" :
                         status.color === "bg-green-500" ? "#22c55e" :
                         status.color === "bg-yellow-500" ? "#eab308" :
                         status.color === "bg-orange-500" ? "#f97316" :
                         "#dc2626"
                }}
              />
            </svg>
            {/* Center value */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center mt-6">
                <div className="text-3xl font-bold">{percentage.toFixed(0)}</div>
                <div className="text-xs text-muted-foreground">/ 100</div>
              </div>
            </div>
          </div>

          {/* Status badge */}
          <Badge variant={status.variant} className="text-sm">
            {status.label}
          </Badge>

          {/* Details */}
          <div className="text-xs text-muted-foreground text-center">
            Indice spectral de fraîcheur
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
