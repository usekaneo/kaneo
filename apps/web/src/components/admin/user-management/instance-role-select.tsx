import { useTranslation } from "react-i18next";
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type InstanceRole = "admin" | "user";

type InstanceRoleSelectProps = {
  id: string;
  value: InstanceRole;
  disabled?: boolean;
  onValueChange: (role: InstanceRole) => void;
};

export function InstanceRoleSelect({
  id,
  value,
  disabled,
  onValueChange,
}: InstanceRoleSelectProps) {
  const { t } = useTranslation();

  return (
    <Select
      items={{
        user: t("settings:adminUsers.roles.user"),
        admin: t("settings:adminUsers.roles.admin"),
      }}
      value={value}
      disabled={disabled}
      onValueChange={(next) => {
        if (next === "admin" || next === "user") onValueChange(next);
      }}
    >
      <SelectTrigger id={id}>
        <SelectValue>
          {t(
            value === "admin"
              ? "settings:adminUsers.roles.admin"
              : "settings:adminUsers.roles.user",
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectPopup>
        <SelectItem value="user">
          {t("settings:adminUsers.roles.user")}
        </SelectItem>
        <SelectItem value="admin">
          {t("settings:adminUsers.roles.admin")}
        </SelectItem>
      </SelectPopup>
    </Select>
  );
}
