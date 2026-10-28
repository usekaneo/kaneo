import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/cn";

type ChannelFieldProps = {
  id: string;
  label: string;
  optional?: boolean;
  hint?: string;
  className?: string;
  children: ReactNode;
};

export function ChannelField({
  id,
  label,
  optional = false,
  hint,
  className,
  children,
}: ChannelFieldProps) {
  const { t } = useTranslation();

  return (
    <div className={cn("min-w-0 space-y-1.5", className)}>
      <div className="flex items-center gap-1.5">
        <Label htmlFor={id}>{label}</Label>
        {optional ? (
          <span className="text-xs text-muted-foreground">
            {t("settings:notificationsPage.optional")}
          </span>
        ) : null}
      </div>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
