import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import useAdminAccess from "@/hooks/queries/admin/use-admin-access";
import useAdminRoles from "@/hooks/queries/admin/use-admin-roles";
import { getAssignableRoles } from "./get-assignable-roles";
import { useInstanceRoleLabel } from "./use-instance-role-label";

type InstanceRoleSelectProps = {
  id: string;
  value: string;
  disabled?: boolean;
  onValueChange: (role: string) => void;
};

export function InstanceRoleSelect({
  id,
  value,
  disabled,
  onValueChange,
}: InstanceRoleSelectProps) {
  const { permissions } = useAdminAccess();
  const { data: roles = [] } = useAdminRoles();
  const roleLabel = useInstanceRoleLabel();
  const names = getAssignableRoles(roles, permissions, value);

  return (
    <Select
      items={Object.fromEntries(names.map((name) => [name, roleLabel(name)]))}
      value={value}
      disabled={disabled}
      onValueChange={(next) => {
        if (typeof next === "string") onValueChange(next);
      }}
    >
      <SelectTrigger id={id}>
        <SelectValue>{roleLabel(value)}</SelectValue>
      </SelectTrigger>
      <SelectPopup>
        {names.map((name) => (
          <SelectItem key={name} value={name}>
            {roleLabel(name)}
          </SelectItem>
        ))}
      </SelectPopup>
    </Select>
  );
}
