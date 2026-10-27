import type { CustomRolePermission } from "@kaneo/permissions";
import { useId } from "react";
import { useTranslation } from "react-i18next";
import { Checkbox } from "@/components/ui/checkbox";
import { PERMISSION_GROUPS } from "./permission-groups";

type RolePermissionFieldsProps = {
  value: readonly CustomRolePermission[];
  disabled?: boolean;
  onChange: (permissions: CustomRolePermission[]) => void;
};

export function RolePermissionFields({
  value,
  disabled,
  onChange,
}: RolePermissionFieldsProps) {
  const { t } = useTranslation();
  const idPrefix = useId();

  const toggle = (permission: CustomRolePermission, checked: boolean) =>
    onChange(
      checked
        ? [...value, permission]
        : value.filter((current) => current !== permission),
    );

  return (
    <div className="flex flex-col gap-4">
      {PERMISSION_GROUPS.map((group) => (
        <fieldset key={group.id} className="flex flex-col gap-2">
          <legend className="mb-1 text-xs font-medium text-muted-foreground">
            {t(group.labelKey)}
          </legend>
          {group.permissions.map(({ permission, labelKey }) => {
            const id = `${idPrefix}-${permission}`;
            return (
              <label
                key={permission}
                htmlFor={id}
                className="flex items-center gap-2 text-sm"
              >
                <Checkbox
                  id={id}
                  checked={value.includes(permission)}
                  disabled={disabled}
                  onCheckedChange={(checked) => toggle(permission, checked)}
                />
                {t(labelKey)}
              </label>
            );
          })}
        </fieldset>
      ))}
    </div>
  );
}
