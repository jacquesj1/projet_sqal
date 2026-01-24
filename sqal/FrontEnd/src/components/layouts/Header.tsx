// ============================================================================
// SQAL Frontend - Header Component
// Top navigation bar with user menu and notifications
// ============================================================================

import { Bell, User, LogOut, Settings, ChevronDown } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useRealtimeStore } from "@stores/realtimeStore";
import { Button } from "@components/ui/button";
import { Badge } from "@components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@components/ui/dropdown-menu";
import { useNavigate } from "react-router-dom";

export function Header() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { unreadAlertsCount, isConnected } = useRealtimeStore();

  const handleLogout = () => {
    logout();
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between px-4">
        {/* Logo & Title */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-white font-bold text-lg">S</span>
            </div>
            <div>
              <h1 className="text-xl font-bold">SQAL</h1>
              <p className="text-xs text-muted-foreground">Qualification Alimentaire</p>
            </div>
          </div>

          {/* Connection Status */}
          <div className="flex items-center gap-2 ml-4">
            <div
              className={`w-2 h-2 rounded-full ${
                isConnected ? "bg-green-500 animate-pulse" : "bg-red-500"
              }`}
            />
            <span className="text-xs text-muted-foreground">
              {isConnected ? "Connecté" : "Déconnecté"}
            </span>
          </div>
        </div>

        {/* Right Side */}
        <div className="flex items-center gap-4">
          {/* User Role Badge */}
          {user?.highestRole && (
            <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-md bg-muted">
              <span className="text-sm font-medium capitalize">
                {user.highestRole.replace('_', ' ')}
              </span>
            </div>
          )}

          {/* Notifications */}
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="h-5 w-5" />
            {unreadAlertsCount > 0 && (
              <Badge
                variant="destructive"
                className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
              >
                {unreadAlertsCount}
              </Badge>
            )}
          </Button>

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="h-4 w-4" />
                </div>
                <div className="hidden md:block text-left">
                  <p className="text-sm font-medium">
                    {user?.firstName || user?.username || 'Utilisateur'}
                  </p>
                  <p className="text-xs text-muted-foreground">{user?.email}</p>
                </div>
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Mon compte</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate("/profile")}>
                <User className="mr-2 h-4 w-4" />
                <span>Profil</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate("/admin/settings")}>
                <Settings className="mr-2 h-4 w-4" />
                <span>Paramètres</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                <span>Déconnexion</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
