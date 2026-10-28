import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import type { AuthProvider } from "./auth-methods";
import { ProviderIcon } from "./provider-icon";

type ProviderButtonsProps = {
  providers: AuthProvider[];
  layout: "compact" | "stacked";
  getName: (provider: AuthProvider) => string;
  lastUsed: string | null;
  pending: AuthProvider | null;
  disabled: boolean;
  onSelect: (provider: AuthProvider) => void;
};

const compactColumns: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-3",
};

export function ProviderButtons({
  providers,
  layout,
  getName,
  lastUsed,
  pending,
  disabled,
  onSelect,
}: ProviderButtonsProps) {
  const { t } = useTranslation();
  const fullLabels = layout === "stacked" || providers.length === 1;
  const primary = layout === "stacked" && providers.length === 1;

  return (
    <div
      className={cn(
        "grid gap-2",
        layout === "compact" &&
          (compactColumns[providers.length] ?? "grid-cols-2"),
      )}
    >
      {providers.map((provider) => {
        const name = getName(provider);
        const isLastUsed = lastUsed === provider && !primary;

        return (
          <div key={provider} className="relative min-w-0">
            <Button
              variant={primary ? "default" : "outline"}
              size="lg"
              className={cn(
                "w-full",
                isLastUsed && "border-foreground/50 dark:border-foreground/50",
              )}
              loading={pending === provider}
              disabled={disabled || pending !== null}
              onClick={() => onSelect(provider)}
              data-provider={provider}
            >
              <ProviderIcon provider={provider} />
              <span className="truncate">
                {fullLabels
                  ? t("auth:providers.continueWith", { provider: name })
                  : name}
              </span>
            </Button>
            {isLastUsed ? (
              <span className="pointer-events-none absolute -top-2 -right-1.5 flex h-4 items-center rounded-sm border border-foreground/50 bg-background px-1 font-medium text-[11px] text-foreground leading-4">
                {t("auth:signIn.lastUsed")}
              </span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
