export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
export const WS_BASE_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000';

export const DEFAULT_GAVEUR_ID = 1;

export const GENETIQUES = ['Mulard', 'Barbarie', 'Pekin'] as const;

export const STATUTS_CANARD = ['en_gavage', 'termine', 'decede'] as const;

export const NIVEAUX_ALERTE = ['critique', 'important', 'info'] as const;

export const ROLES_UTILISATEUR = ['admin', 'gaveur', 'veterinaire', 'observateur'] as const;

export const TYPES_CERTIFICATION = ['Label Rouge', 'IGP', 'Bio', 'AOP', 'Autre'] as const;

export const ETATS_SANITAIRES = ['excellent', 'bon', 'moyen', 'faible', 'critique'] as const;

export const NIVEAUX_ACTIVITE = ['tres_actif', 'actif', 'normal', 'apathique'] as const;

export const TYPES_PHOTO = ['canard', 'gavage', 'sanitaire', 'documentation'] as const;

export const NAV_ITEMS = [
  { label: 'Dashboard', href: '/', icon: 'LayoutDashboard' },
  { label: 'Gavage', href: '/gavage', icon: 'Wheat' },
  { label: 'Analytics', href: '/analytics', icon: 'BarChart3' },
  { label: 'Blockchain', href: '/blockchain', icon: 'Shield' },
  { label: 'Alertes', href: '/alertes', icon: 'Bell' },
  { label: 'Canards', href: '/canards', icon: 'Bird' },
] as const;

export const SECONDARY_NAV_ITEMS = [
  { label: 'Environnement', href: '/environnement', icon: 'Thermometer' },
  { label: 'Vétérinaires', href: '/veterinaires', icon: 'Stethoscope' },
  { label: 'Certifications', href: '/certifications', icon: 'Award' },
  { label: 'Simulations', href: '/simulations', icon: 'Zap' },
  { label: 'Photos', href: '/photos/upload', icon: 'Camera' },
  { label: 'Scan QR', href: '/scan', icon: 'QrCode' },
] as const;

export const SEUILS = {
  ecart_dose_warning: 10,
  ecart_dose_critique: 25,
  temperature_min: 18,
  temperature_max: 26,
  humidite_min: 50,
  humidite_max: 80,
  co2_max: 3000,
  nh3_max: 25,
  score_performance_excellent: 80,
  score_performance_bon: 60,
  indice_consommation_optimal: 5.5,
} as const;

export const COULEURS_GRAPHIQUES = {
  primary: '#6366f1',
  secondary: '#8b5cf6',
  accent: '#06b6d4',
  success: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',
  blue: '#3b82f6',
  green: '#22c55e',
  red: '#ef4444',
  orange: '#f97316',
  purple: '#a855f7',
} as const;

export const PAGINATION = {
  defaultPageSize: 10,
  pageSizeOptions: [10, 25, 50, 100],
} as const;
