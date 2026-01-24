// ============================================================================
// Admin Users Page
// Gestion des utilisateurs et des rôles
// ============================================================================

import { useQuery } from "@tanstack/react-query";
import type { UsersResponse } from "@/types/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@components/ui/card";
import { Badge } from "@components/ui/badge";
import { Button } from "@components/ui/button";
import api from "@services/api";
import { Users, UserPlus, Edit, Trash2, Shield } from "lucide-react";

export function AdminUsersPage() {
  const { data: usersData } = useQuery<UsersResponse>({
    queryKey: ["admin", "users"],
    queryFn: () => api.admin.getUsers(),
  });

  const getRoleBadge = (roles: string[]) => {
    if (!roles || roles.length === 0) return null;
    
    const roleColors: Record<string, string> = {
      super_admin: "bg-purple-500",
      org_admin: "bg-blue-500",
      quality_manager: "bg-green-500",
      production_operator: "bg-yellow-500",
      data_analyst: "bg-orange-500",
      viewer: "bg-gray-500",
    };

    return roles.map((role) => (
      <Badge key={role} className={roleColors[role] || "bg-gray-500"}>
        {role.replace("_", " ")}
      </Badge>
    ));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Gestion des Utilisateurs</h1>
          <p className="text-muted-foreground">
            Gérez les utilisateurs et leurs permissions
          </p>
        </div>
        <Button>
          <UserPlus className="w-4 h-4 mr-2" />
          Nouvel Utilisateur
        </Button>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Utilisateurs</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{usersData?.total || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Actifs</CardTitle>
            <Shield className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">
              {usersData?.active || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Administrateurs</CardTitle>
            <Shield className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-500">
              {usersData?.users?.filter((u: any) => u.isStaff).length || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Liste des utilisateurs */}
      <Card>
        <CardHeader>
          <CardTitle>Utilisateurs</CardTitle>
          <CardDescription>
            {usersData?.users?.length || 0} utilisateur(s) enregistré(s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {usersData?.users?.map((user: any) => (
              <div
                key={user.id}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <Users className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{user.username}</p>
                      {user.isStaff && (
                        <Badge variant="outline" className="text-purple-500">
                          <Shield className="w-3 h-3 mr-1" />
                          Admin
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                    <div className="flex gap-1 mt-1">
                      {getRoleBadge(user.roles)}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Dernière connexion</p>
                    <p className="text-sm">
                      {user.lastLogin
                        ? new Date(user.lastLogin).toLocaleDateString("fr-FR")
                        : "Jamais"}
                    </p>
                  </div>
                  <Badge variant={user.isActive ? "default" : "secondary"}>
                    {user.isActive ? "Actif" : "Inactif"}
                  </Badge>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline">
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="outline" className="text-red-500">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
