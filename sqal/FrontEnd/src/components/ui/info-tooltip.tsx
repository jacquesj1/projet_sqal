// ============================================================================
// SQAL Frontend - Info Tooltip Component
// Reusable tooltip component for contextual help and explanations
// ============================================================================

import { Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface InfoTooltipProps {
  content: string | React.ReactNode;
  className?: string;
  side?: "top" | "right" | "bottom" | "left";
  maxWidth?: string;
}

export function InfoTooltip({
  content,
  className = "",
  side = "top",
  maxWidth = "xs",
}: InfoTooltipProps) {
  const maxWidthClass = {
    xs: "max-w-xs",
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
  }[maxWidth] || "max-w-xs";

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Info
            className={`h-4 w-4 text-muted-foreground hover:text-foreground cursor-help transition-colors ${className}`}
          />
        </TooltipTrigger>
        <TooltipContent side={side} className={maxWidthClass}>
          {typeof content === "string" ? (
            <p className="text-sm">{content}</p>
          ) : (
            content
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Composant pour tooltips avec titre et contenu structuré
interface DetailedInfoTooltipProps {
  title: string;
  description: string;
  items?: string[];
  className?: string;
  side?: "top" | "right" | "bottom" | "left";
}

export function DetailedInfoTooltip({
  title,
  description,
  items,
  className = "",
  side = "top",
}: DetailedInfoTooltipProps) {
  return (
    <InfoTooltip
      side={side}
      className={className}
      maxWidth="md"
      content={
        <div className="space-y-2">
          <h4 className="font-semibold text-sm">{title}</h4>
          <p className="text-sm text-muted-foreground">{description}</p>
          {items && items.length > 0 && (
            <ul className="text-sm text-muted-foreground list-disc pl-4 space-y-1">
              {items.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          )}
        </div>
      }
    />
  );
}
