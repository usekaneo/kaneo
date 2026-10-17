import type { ReactNode } from "react";
import { SettingsRow } from "@/components/settings/settings-row";
import {
  FormControl,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

type SettingsFormRowProps = {
  label: ReactNode;
  description?: ReactNode;
  children: ReactNode;
};

export function SettingsFormRow({
  label,
  description,
  children,
}: SettingsFormRowProps) {
  return (
    <FormItem className="space-y-0">
      <SettingsRow
        stack
        title={<FormLabel>{label}</FormLabel>}
        description={description}
      >
        <FormControl>{children}</FormControl>
      </SettingsRow>
      <FormMessage className="-mt-1.5 px-4 pb-3 text-xs" />
    </FormItem>
  );
}
