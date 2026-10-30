import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import {
  BILLING_INTERVALS,
  type BillingIntervalKey,
} from "@/constants/billing";
import { cn } from "@/lib/cn";

type BillingIntervalToggleProps = {
  value: BillingIntervalKey;
  onChange: (value: BillingIntervalKey) => void;
};

export function BillingIntervalToggle({
  value,
  onChange,
}: BillingIntervalToggleProps) {
  const { t } = useTranslation();

  return (
    <div className="inline-flex items-center gap-2">
      <div className="inline-flex rounded-md border border-border bg-sidebar p-0.5 text-xs">
        {BILLING_INTERVALS.map((interval) => (
          <button
            key={interval}
            type="button"
            aria-pressed={value === interval}
            onClick={() => onChange(interval)}
            className={cn(
              "rounded-[0.3rem] px-3 py-1 font-medium transition-colors",
              value === interval
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t(`settings:billing.interval.${interval}`)}
          </button>
        ))}
      </div>
      {value === "annual" ? (
        <Badge variant="success" size="sm">
          {t("settings:billing.interval.annualBadge")}
        </Badge>
      ) : null}
    </div>
  );
}
