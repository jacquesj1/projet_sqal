import React, { useEffect, useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import { Switch } from '../ui/switch';
import { Badge } from '../ui/badge';
import { Alert, AlertDescription } from '../ui/alert';
import {
  Bell,
  Plus,
  Trash2,
  Edit,
  AlertTriangle,
  Info,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';

// Types
interface AlertRule {
  id: string;
  name: string;
  condition: string;
  severity: 'info' | 'warning' | 'critical';
  enabled: boolean;
  notify_channels: string[];
  created_at: string;
  updated_at?: string;
}

interface AlertRulesManagerProps {
  className?: string;
}

type Severity = 'info' | 'warning' | 'critical';

// Severity configurations
const SEVERITY_CONFIG: Record<
  Severity,
  {
    label: string;
    icon: React.ReactNode;
    color: string;
    bgColor: string;
  }
> = {
  info: {
    label: 'Info',
    icon: <Info className="h-4 w-4" />,
    color: 'text-blue-600',
    bgColor: 'bg-blue-100 dark:bg-blue-900/30',
  },
  warning: {
    label: 'Attention',
    icon: <AlertTriangle className="h-4 w-4" />,
    color: 'text-amber-600',
    bgColor: 'bg-amber-100 dark:bg-amber-900/30',
  },
  critical: {
    label: 'Critique',
    icon: <AlertCircle className="h-4 w-4" />,
    color: 'text-red-600',
    bgColor: 'bg-red-100 dark:bg-red-900/30',
  },
};

// Predefined condition templates
const CONDITION_TEMPLATES = [
  { value: 'quality_score < 0.7', label: 'Score qualité < 0.7' },
  { value: 'quality_score < 0.5', label: 'Score qualité < 0.5 (critique)' },
  { value: 'grade == "REJECT"', label: 'Grade REJECT' },
  { value: 'grade == "C"', label: 'Grade C' },
  { value: 'volume_mm3 > 150', label: 'Volume > 150 mm³' },
  { value: 'volume_mm3 < 100', label: 'Volume < 100 mm³' },
  { value: 'height_mm < 20', label: 'Hauteur < 20 mm' },
  { value: 'height_mm > 30', label: 'Hauteur > 30 mm' },
];

/**
 * AlertRulesManager - Professional alert rules management
 *
 * Features:
 * - CRUD operations for alert rules
 * - Real-time enable/disable
 * - Severity levels (info, warning, critical)
 * - Condition templates
 * - Responsive table/cards layout
 * - Professional agro-food design
 */
export const AlertRulesManager: React.FC<AlertRulesManagerProps> = ({
  className = '',
}) => {
  // State
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<AlertRule | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    condition: '',
    severity: 'warning' as Severity,
    enabled: true,
  });

  // Fetch rules
  const fetchRules = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/alerts/rules');
      if (!response.ok) throw new Error('Échec de chargement');

      const data = await response.json();
      setRules(data);
    } catch (error) {
      toast.error('Impossible de charger les règles d\'alerte');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRules();
  }, []);

  // Create or update rule
  const handleSave = async () => {
    if (!formData.name || !formData.condition) {
      toast.error('Nom et condition sont requis');
      return;
    }

    try {
      const url = editingRule
        ? `/api/alerts/rules/${editingRule.id}`
        : '/api/alerts/rules';

      const method = editingRule ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          condition: formData.condition,
          severity: formData.severity,
          enabled: formData.enabled,
          notify_channels: ['websocket'],
        }),
      });

      if (!response.ok) throw new Error('Échec de sauvegarde');

      toast.success(editingRule ? 'Règle modifiée avec succès' : 'Règle créée avec succès');

      // Reset form and close dialog
      setFormData({
        name: '',
        condition: '',
        severity: 'warning',
        enabled: true,
      });
      setEditingRule(null);
      setIsDialogOpen(false);

      // Refresh list
      fetchRules();
    } catch (error) {
      toast.error('Impossible de sauvegarder la règle');
    }
  };

  // Delete rule
  const handleDelete = async (id: string) => {
    if (!confirm('Confirmer la suppression de cette règle ?')) return;

    try {
      const response = await fetch(`/api/alerts/rules/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Échec de suppression');

      toast.success('Règle supprimée avec succès');

      fetchRules();
    } catch (error) {
      toast.error('Impossible de supprimer la règle');
    }
  };

  // Toggle rule enabled status
  const handleToggle = async (rule: AlertRule) => {
    try {
      const response = await fetch(`/api/alerts/rules/${rule.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: !rule.enabled,
        }),
      });

      if (!response.ok) throw new Error('Échec de mise à jour');

      toast.success(rule.enabled ? 'Règle désactivée' : 'Règle activée');

      fetchRules();
    } catch (error) {
      toast.error('Impossible de modifier la règle');
    }
  };

  // Open edit dialog
  const handleEdit = (rule: AlertRule) => {
    setEditingRule(rule);
    setFormData({
      name: rule.name,
      condition: rule.condition,
      severity: rule.severity,
      enabled: rule.enabled,
    });
    setIsDialogOpen(true);
  };

  // Open create dialog
  const handleCreate = () => {
    setEditingRule(null);
    setFormData({
      name: '',
      condition: '',
      severity: 'warning',
      enabled: true,
    });
    setIsDialogOpen(true);
  };

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-primary" />
              Règles d'Alerte
            </CardTitle>
            <CardDescription className="mt-1">
              Gérer les alertes qualité automatiques
            </CardDescription>
          </div>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={handleCreate} className="gap-2">
                <Plus className="h-4 w-4" />
                Nouvelle Règle
              </Button>
            </DialogTrigger>

            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>
                  {editingRule ? 'Modifier la Règle' : 'Créer une Règle'}
                </DialogTitle>
                <DialogDescription>
                  Définir les conditions d'alerte pour le contrôle qualité
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                {/* Name */}
                <div className="space-y-2">
                  <Label htmlFor="name">Nom de la règle</Label>
                  <Input
                    id="name"
                    placeholder="Ex: Alerte qualité faible"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                  />
                </div>

                {/* Condition */}
                <div className="space-y-2">
                  <Label htmlFor="condition">Condition</Label>
                  <Select
                    value={formData.condition}
                    onValueChange={(v) =>
                      setFormData({ ...formData, condition: v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner une condition" />
                    </SelectTrigger>
                    <SelectContent>
                      {CONDITION_TEMPLATES.map((template) => (
                        <SelectItem key={template.value} value={template.value}>
                          {template.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Ou entrer une condition personnalisée
                  </p>
                  <Input
                    id="condition"
                    placeholder="Ex: quality_score < 0.7"
                    value={formData.condition}
                    onChange={(e) =>
                      setFormData({ ...formData, condition: e.target.value })
                    }
                  />
                </div>

                {/* Severity */}
                <div className="space-y-2">
                  <Label htmlFor="severity">Sévérité</Label>
                  <Select
                    value={formData.severity}
                    onValueChange={(v) =>
                      setFormData({ ...formData, severity: v as Severity })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(SEVERITY_CONFIG).map(([key, config]) => (
                        <SelectItem key={key} value={key}>
                          <div className="flex items-center gap-2">
                            {config.icon}
                            {config.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Enabled */}
                <div className="flex items-center justify-between">
                  <Label htmlFor="enabled">Activer immédiatement</Label>
                  <Switch
                    id="enabled"
                    checked={formData.enabled}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, enabled: checked })
                    }
                  />
                </div>
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                >
                  Annuler
                </Button>
                <Button onClick={handleSave}>
                  {editingRule ? 'Modifier' : 'Créer'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="flex h-[200px] items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : rules.length === 0 ? (
          <Alert>
            <Bell className="h-4 w-4" />
            <AlertDescription>
              Aucune règle d'alerte configurée. Créez votre première règle pour
              recevoir des notifications automatiques.
            </AlertDescription>
          </Alert>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nom</TableHead>
                    <TableHead>Condition</TableHead>
                    <TableHead>Sévérité</TableHead>
                    <TableHead>État</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rules.map((rule) => {
                    const severityConfig = SEVERITY_CONFIG[rule.severity];
                    return (
                      <TableRow key={rule.id}>
                        <TableCell className="font-medium">{rule.name}</TableCell>
                        <TableCell>
                          <code className="rounded bg-muted px-2 py-1 text-xs">
                            {rule.condition}
                          </code>
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={`${severityConfig.bgColor} ${severityConfig.color} gap-1`}
                            variant="outline"
                          >
                            {severityConfig.icon}
                            {severityConfig.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={rule.enabled}
                            onCheckedChange={() => handleToggle(rule)}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEdit(rule)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(rule.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Mobile Cards */}
            <div className="space-y-3 md:hidden">
              {rules.map((rule) => {
                const severityConfig = SEVERITY_CONFIG[rule.severity];
                return (
                  <Card key={rule.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium">{rule.name}</h4>
                            <Badge
                              className={`${severityConfig.bgColor} ${severityConfig.color} gap-1`}
                              variant="outline"
                            >
                              {severityConfig.icon}
                            </Badge>
                          </div>
                          <code className="block rounded bg-muted px-2 py-1 text-xs">
                            {rule.condition}
                          </code>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={rule.enabled}
                              onCheckedChange={() => handleToggle(rule)}
                            />
                            <span className="text-sm text-muted-foreground">
                              {rule.enabled ? 'Activée' : 'Désactivée'}
                            </span>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(rule)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(rule.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};
