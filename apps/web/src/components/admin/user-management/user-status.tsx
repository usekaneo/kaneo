import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";

type UserStatusProps = {
  isDeactivated: boolean;
};

export function UserStatus({ isDeactivated }: UserStatusProps) {
  const { t } = useTranslation();

  return (
    <span className="flex items-center gap-1.5 text-[13px]">
      <span
        aria-hidden="true"
        className={cn(
          "size-1.5 shrink-0 rounded-full",
          isDeactivated ? "bg-muted-foreground" : "bg-success",
        )}
      />
      <span
        className={isDeactivated ? "text-muted-foreground" : "text-foreground"}
      >
        {t(
          isDeactivated
            ? "settings:adminUsers.status.deactivated"
            : "settings:adminUsers.status.active",
        )}
      </span>
    </span>
  );
}
