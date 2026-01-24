// ============================================================================
// SQAL Frontend - Organization Types
// Types pour les organisations et multi-site
// ============================================================================

export interface Organization {
  id: string;
  name: string;
  description?: string;
  type: OrganizationType;
  parentId?: string;
  settings: OrganizationSettings;
  createdAt: string;
  updatedAt: string;
}

export type OrganizationType = "enterprise" | "site" | "production_line" | "department";

export interface OrganizationSettings {
  timezone: string;
  locale: string;
  currency: string;
  qualityThresholds: QualityThresholds;
  notifications: NotificationSettings;
}

export interface QualityThresholds {
  minAcceptableScore: number;
  maxDefects: number;
  alertThreshold: number;
}

export interface NotificationSettings {
  email: boolean;
  sms: boolean;
  push: boolean;
  alertOnDefect: boolean;
  alertOnLowQuality: boolean;
}

export interface Site {
  id: string;
  organizationId: string;
  name: string;
  address: string;
  city: string;
  country: string;
  timezone: string;
  isActive: boolean;
}

export interface OrganizationHierarchy {
  organization: Organization;
  children: OrganizationHierarchy[];
}
