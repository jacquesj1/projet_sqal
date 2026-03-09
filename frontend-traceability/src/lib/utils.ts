import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: Date | string): string {
  const d = new Date(date)
  return d.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export function formatDateTime(date: Date | string): string {
  const d = new Date(date)
  return d.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

export function getQualityGrade(score: number): 'excellent' | 'good' | 'poor' {
  if (score >= 80) return 'excellent'
  if (score >= 60) return 'good'
  return 'poor'
}

export function getQualityLabel(grade: string): string {
  switch (grade) {
    case 'excellent': return 'Excellente'
    case 'good': return 'Correcte'
    case 'poor': return 'Faible'
    default: return 'Inconnue'
  }
}

export function truncateHash(hash: string, length: number = 16): string {
  if (hash.length <= length) return hash
  return `${hash.slice(0, length)}...`
}

export function generateShareText(productName: string, score: number): string {
  return `Découvrez la traçabilité de ${productName} - Qualité: ${score}% via Euralis`
}

export function isValidTraceId(id: string): boolean {
  return /^[a-zA-Z0-9]{8,32}$/.test(id)
}

export function extractTraceIdFromQR(qrCode: string): string | null {
  try {
    // Try to parse as URL first
    const url = new URL(qrCode)
    const pathParts = url.pathname.split('/')
    const id = pathParts[pathParts.length - 1]
    return isValidTraceId(id) ? id : null
  } catch {
    // If not URL, check if it's a direct ID
    return isValidTraceId(qrCode) ? qrCode : null
  }
}