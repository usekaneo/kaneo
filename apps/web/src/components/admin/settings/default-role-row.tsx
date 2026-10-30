import { useId } from "react";
import { useTranslation } from "react-i18next";
import { useInstanceRoleLabel } from "@/components/admin/user-management/use-instance-role-label";
import { SettingsRow } from "@/components/settings/settings-row";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type DefaultRoleRowProps = {
  value: string;
  roles: string[];
  disabled: boolean;
  onValueChange: (role: string) => void;
};

export function DefaultRoleRow({
  value,
  roles,
  disabled,
  onValueChange,
}: DefaultRoleRowProps) {
  const { t } = useTranslation();
  const id = useId();
  const roleLabel = useInstanceRoleLabel();
  const names = ["user", ...roles];

  return (
    <SettingsRow
      stack
      title={
        <Label htmlFor={id}>{t("settings:adminSettings.defaultRole")}</Label>
      }
    >
      <Select
        items={Object.fromEntries(names.map((name) => [name, roleLabel(name)]))}
        value={value}
        disabled={disabled}
        onValueChange={(next) => {
          if (typeof next === "string" && next !== value) onValueChange(next);
        }}
      >
        <SelectTrigger id={id} className="w-full sm:w-56">
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
    </SettingsRow>
  );
}
