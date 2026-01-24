// ============================================================================
// SQAL Frontend - Formatters Utilities
// Fonctions utilitaires pour le formatage des données
// ============================================================================

/**
 * Formate un nombre avec séparateurs de milliers
 */
export function formatNumber(num: number, decimals: number = 2): string {
  return new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);
}

/**
 * Formate un pourcentage
 */
export function formatPercentage(value: number, decimals: number = 1): string {
  return `${formatNumber(value, decimals)}%`;
}

/**
 * Formate une date
 */
export function formatDate(date: string | Date, format: "short" | "long" = "short"): string {
  const d = typeof date === "string" ? new Date(date) : date;
  
  if (format === "long") {
    return new Intl.DateTimeFormat("fr-FR", {
      dateStyle: "long",
      timeStyle: "medium",
    }).format(d);
  }
  
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(d);
}

/**
 * Formate une taille en octets
 */
export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

/**
 * Formate une durée en millisecondes
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3600000) return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
  return `${Math.floor(ms / 3600000)}h ${Math.floor((ms % 3600000) / 60000)}m`;
}

/**
 * Tronque un texte avec ellipse
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + "...";
}
