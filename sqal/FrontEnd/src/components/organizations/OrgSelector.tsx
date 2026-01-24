// ============================================================================
// SQAL Frontend - Organization Selector Component
// Sélecteur d'organisation pour multi-site
// ============================================================================

import { useOrganizationStore } from "@/stores/organizationStore";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function OrgSelector() {
  const { organizations, currentOrganization, setCurrentOrganization } = useOrganizationStore();

  const handleOrgChange = (orgId: string) => {
    const org = organizations.find((o) => o.id === orgId);
    if (org) {
      setCurrentOrganization(org);
    }
  };

  if (organizations.length <= 1) {
    return null; // Ne pas afficher si une seule organisation
  }

  return (
    <Select
      value={currentOrganization?.id}
      onValueChange={handleOrgChange}
    >
      <SelectTrigger className="w-[200px]">
        <SelectValue placeholder="Sélectionner une organisation" />
      </SelectTrigger>
      <SelectContent>
        {organizations.map((org) => (
          <SelectItem key={org.id} value={org.id}>
            {org.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
