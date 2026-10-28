import { useTranslation } from "react-i18next";
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getWorkspaceRoleLabel } from "./get-workspace-role-label";

type Props = {
  value: string;
  options: readonly string[];
  onValueChange: (role: string) => void;
  id?: string;
  label?: string;
  disabled?: boolean;
  size?: "sm" | "default";
  className?: string;
};

function WorkspaceRoleSelect({
  value,
  options,
  onValueChange,
  id,
  label,
  disabled,
  size,
  className,
}: Props) {
  const { t } = useTranslation();
  const items = options.map((role) => ({
    value: role,
    label: getWorkspaceRoleLabel(role, t),
  }));

  return (
    <Select
      items={items}
      value={value}
      disabled={disabled}
      onValueChange={(next) => {
        if (typeof next === "string" && next) onValueChange(next);
      }}
    >
      <SelectTrigger
        id={id}
        aria-label={label}
        size={size}
        className={className}
      >
        <SelectValue>{getWorkspaceRoleLabel(value, t)}</SelectValue>
      </SelectTrigger>
      <SelectPopup>
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectPopup>
    </Select>
  );
}

export default WorkspaceRoleSelect;
