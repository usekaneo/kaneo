import type { ReactNode } from "react";
import { SettingsRow } from "@/components/settings/settings-row";

type SystemStatusRowProps = {
  icon: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  status: ReactNode;
  action?: ReactNode;
};

export function SystemStatusRow({
  icon,
  title,
  description,
  status,
  action,
}: SystemStatusRowProps) {
  return (
    <SettingsRow icon={icon} title={title} description={description}>
      {action}
      {status}
    </SettingsRow>
  );
}
