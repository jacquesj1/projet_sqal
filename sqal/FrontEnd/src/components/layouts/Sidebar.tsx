// ============================================================================
// SQAL Frontend - Sidebar Component
// Left navigation sidebar with menu items
// ============================================================================

import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  LineChart,
  Brain,
  FileText,
  Settings,
  Users,
  HardDrive,
  Shield,
  Activity,
  BarChart3,
  Beef,
  Merge,
} from "lucide-react";
import { cn } from "@lib/utils";
import { usePermissions } from "@hooks/usePermissions";
import { ROUTES } from "@constants/index";

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  permission?: string;
  children?: NavItem[];
}

const navItems: NavItem[] = [
  {
    title: "Dashboard",
    href: ROUTES.DASHBOARD,
    icon: LayoutDashboard,
    permission: "dashboard:view",
  },
  {
    title: "Analyses",
    href: ROUTES.ANALYSIS,
    icon: LineChart,
    permission: "analysis:view",
    children: [
      {
        title: "Temps Réel",
        href: ROUTES.ANALYSIS,
        icon: Activity,
        permission: "analysis:view",
      },
      {
        title: "Historique",
        href: ROUTES.ANALYSIS_HISTORY,
        icon: LineChart,
        permission: "analysis:view",
      },
    ],
  },
  {
    title: "Capteurs",
    href: ROUTES.SENSORS_VL53L8CH,
    icon: Activity,
    permission: "analysis:view",
    children: [
      {
        title: "VL53L8CH (ToF)",
        href: ROUTES.SENSORS_VL53L8CH,
        icon: Activity,
        permission: "analysis:view",
      },
      {
        title: "AS7341 (Spectral)",
        href: ROUTES.SENSORS_AS7341,
        icon: Activity,
        permission: "analysis:view",
      },
      {
        title: "Fusion Multi-Capteurs",
        href: ROUTES.SENSORS_FUSION,
        icon: Merge,
        permission: "analysis:view",
      },
    ],
  },
  {
    title: "Analytics & Tendances",
    href: ROUTES.ANALYTICS,
    icon: BarChart3,
    permission: "analysis:view",
  },
  {
    title: "Foie Gras",
    href: "/foiegras",
    icon: Beef,
    permission: "analysis:view",
  },
  {
    title: "Blockchain",
    href: "/blockchain",
    icon: Shield,
    permission: "analysis:view",
  },
  {
    title: "Intelligence IA",
    href: ROUTES.AI,
    icon: Brain,
    permission: "ai:view",
    children: [
      {
        title: "Monitoring",
        href: ROUTES.AI_MONITORING,
        icon: Activity,
        permission: "ai:view",
      },
      {
        title: "Entraînement",
        href: ROUTES.AI_TRAINING,
        icon: Brain,
        permission: "ai:manage",
      },
      {
        title: "Modèles",
        href: ROUTES.AI_MODELS,
        icon: HardDrive,
        permission: "ai:view",
      },
    ],
  },
  {
    title: "Rapports",
    href: ROUTES.REPORTS,
    icon: FileText,
    permission: "reports:view",
  },
  {
    title: "Administration",
    href: ROUTES.ADMIN,
    icon: Settings,
    permission: "users:view",
    children: [
      {
        title: "Dispositifs",
        href: ROUTES.ADMIN_DEVICES,
        icon: HardDrive,
        permission: "devices:view",
      },
      {
        title: "Firmware",
        href: ROUTES.ADMIN_FIRMWARE,
        icon: Shield,
        permission: "firmware:manage",
      },
      {
        title: "Calibration",
        href: ROUTES.ADMIN_CALIBRATION,
        icon: Activity,
        permission: "devices:manage",
      },
      {
        title: "Utilisateurs",
        href: ROUTES.ADMIN_USERS,
        icon: Users,
        permission: "users:view",
      },
      {
        title: "Audit",
        href: ROUTES.ADMIN_AUDIT,
        icon: Activity,
        permission: "audit:view",
      },
    ],
  },
];

export function Sidebar() {
  const {
    canViewDashboard,
    canEditData,
    canManageUsers,
    canGenerateReports
  } = usePermissions();

  // Map permissions to role checks
  const checkPermission = (permission?: string): boolean => {
    if (!permission) return true;
    
    // Map old permission strings to new role-based checks
    switch (permission) {
      case 'dashboard:view':
        return canViewDashboard;
      case 'analysis:view':
        return canViewDashboard;
      case 'ai:view':
        return canViewDashboard;
      case 'ai:manage':
        return canEditData;
      case 'reports:view':
        return canGenerateReports;
      case 'users:view':
      case 'devices:view':
      case 'firmware:manage':
      case 'devices:manage':
      case 'audit:view':
        return canManageUsers;
      default:
        return canViewDashboard; // Default: allow if can view dashboard
    }
  };

  const renderNavItem = (item: NavItem, depth: number = 0) => {
    // Check permission
    if (!checkPermission(item.permission)) {
      return null;
    }

    const Icon = item.icon;
    const hasChildren = item.children && item.children.length > 0;

    if (hasChildren) {
      return (
        <div key={item.href} className="space-y-1">
          <div
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground",
              depth > 0 && "pl-6"
            )}
          >
            <Icon className="h-4 w-4" />
            <span>{item.title}</span>
          </div>
          <div className="space-y-1">
            {item.children && item.children.map((child) => renderNavItem(child, depth + 1))}
          </div>
        </div>
      );
    }

    return (
      <NavLink
        key={item.href}
        to={item.href}
        className={({ isActive }) =>
          cn(
            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            depth > 0 && "pl-6",
            isActive
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          )
        }
      >
        <Icon className="h-4 w-4" />
        <span>{item.title}</span>
      </NavLink>
    );
  };

  return (
    <aside className="fixed left-0 top-16 z-40 h-[calc(100vh-4rem)] w-64 border-r bg-background">
      <div className="flex h-full flex-col gap-2 overflow-y-auto p-4">
        <nav className="flex flex-col gap-1">
          {navItems.map((item) => renderNavItem(item))}
        </nav>
      </div>
    </aside>
  );
}
