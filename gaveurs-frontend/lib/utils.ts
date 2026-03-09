export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDateTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString('fr-FR');
}

export function formatTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDateShort(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
  });
}

export function truncateHash(hash: string, length: number = 16): string {
  if (hash.length <= length) return hash;
  const half = Math.floor(length / 2);
  return `${hash.substring(0, half)}...${hash.substring(hash.length - half)}`;
}

export function getScoreColor(score: number): string {
  if (score >= 80) return 'text-green-600';
  if (score >= 60) return 'text-yellow-600';
  return 'text-red-600';
}

export function getScoreBgColor(score: number): string {
  if (score >= 80) return 'bg-green-100';
  if (score >= 60) return 'bg-yellow-100';
  return 'bg-red-100';
}

export function getNiveauColor(niveau: string): string {
  switch (niveau) {
    case 'critique':
      return 'bg-red-100 border-red-500 text-red-800';
    case 'important':
      return 'bg-orange-100 border-orange-500 text-orange-800';
    case 'info':
      return 'bg-blue-100 border-blue-500 text-blue-800';
    default:
      return 'bg-gray-100 border-gray-500 text-gray-800';
  }
}

export function getNiveauBadgeColor(niveau: string): string {
  switch (niveau) {
    case 'critique':
      return 'bg-red-600 text-white';
    case 'important':
      return 'bg-orange-500 text-white';
    case 'info':
      return 'bg-blue-600 text-white';
    default:
      return 'bg-gray-500 text-white';
  }
}

export function getNiveauIcon(niveau: string): string {
  switch (niveau) {
    case 'critique':
      return '🚨';
    case 'important':
      return '⚠️';
    case 'info':
      return 'ℹ️';
    default:
      return '📌';
  }
}

export function calculateEcart(reel: number, theorique: number): number {
  if (!theorique) return 0;
  return ((reel - theorique) / theorique) * 100;
}

export function getEcartColor(ecart: number): string {
  const abs = Math.abs(ecart);
  if (abs >= 25) return 'text-red-600';
  if (abs >= 10) return 'text-orange-500';
  return 'text-green-600';
}

export function getStatutColor(statut: string): string {
  switch (statut) {
    case 'en_gavage':
      return 'bg-green-100 text-green-800';
    case 'termine':
      return 'bg-blue-100 text-blue-800';
    case 'decede':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

export function getStatutLabel(statut: string): string {
  switch (statut) {
    case 'en_gavage':
      return 'En gavage';
    case 'termine':
      return 'Terminé';
    case 'decede':
      return 'Décédé';
    default:
      return statut;
  }
}

export function getGenetiqueEmoji(genetique: string): string {
  switch (genetique) {
    case 'Mulard':
      return '🦆';
    case 'Barbarie':
      return '🦢';
    case 'Pekin':
      return '🐥';
    default:
      return '🦆';
  }
}

export function formatNumber(num: number, decimals: number = 0): string {
  return num.toLocaleString('fr-FR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatWeight(grams: number): string {
  if (grams >= 1000) {
    return `${(grams / 1000).toFixed(2)} kg`;
  }
  return `${grams} g`;
}

export function formatPercentage(value: number, decimals: number = 1): string {
  return `${value.toFixed(decimals)}%`;
}

export function classNames(...classes: (string | boolean | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

export function getEventIcon(type: string): string {
  switch (type) {
    case 'genesis':
      return '🌟';
    case 'initialisation_canard':
      return '🐣';
    case 'gavage':
      return '🌽';
    case 'pesee':
      return '⚖️';
    case 'abattage':
      return '🏭';
    case 'transport':
      return '🚚';
    default:
      return '📦';
  }
}

export function getEventLabel(type: string): string {
  const labels: Record<string, string> = {
    genesis: 'Bloc Genesis',
    initialisation_canard: 'Initialisation',
    gavage: 'Gavage',
    pesee: 'Pesée',
    abattage: 'Abattage',
    transport: 'Transport',
  };
  return labels[type] || type;
}

export function isToday(dateString: string): boolean {
  const date = new Date(dateString);
  const today = new Date();
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
}

export function daysAgo(dateString: string): number {
  const date = new Date(dateString);
  const today = new Date();
  const diffTime = today.getTime() - date.getTime();
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

export function getRelativeTime(dateString: string): string {
  const days = daysAgo(dateString);
  if (days === 0) return "Aujourd'hui";
  if (days === 1) return 'Hier';
  if (days < 7) return `Il y a ${days} jours`;
  if (days < 30) return `Il y a ${Math.floor(days / 7)} semaines`;
  return formatDate(dateString);
}
