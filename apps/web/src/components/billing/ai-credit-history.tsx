import { useId } from "react";
import { useTranslation } from "react-i18next";
import type { getAiCredit } from "@/fetchers/billing/ai-credit";
import { formatAiCredit } from "./format-ai-credit";

type Entry = Awaited<ReturnType<typeof getAiCredit>>["entries"][number];

const kindKeys: Record<string, string> = {
  usage: "settings:billing.ai.usage",
  trial: "settings:billing.ai.trialEntry",
  topup: "settings:billing.ai.topup",
};

export function AiCreditHistory({ entries }: { entries: Entry[] }) {
  const { t, i18n } = useTranslation();
  const headingId = useId();
  if (!entries.length) return null;
  const dates = new Intl.DateTimeFormat(i18n.language, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <div className="px-4 py-3">
      <h3 id={headingId} className="text-xs font-medium text-muted-foreground">
        {t("settings:billing.ai.history")}
      </h3>
      <ul aria-labelledby={headingId} className="divide-y divide-border">
        {entries.map((entry) => (
          <li key={entry.id} className="flex items-start gap-4 py-2.5">
            <div className="min-w-0 flex-1 space-y-0.5">
              <p className="text-sm">
                {t(kindKeys[entry.kind] ?? "settings:billing.ai.reversal")}
              </p>
              <p className="flex min-w-0 gap-1.5 text-xs text-muted-foreground">
                <time dateTime={entry.createdAt} className="shrink-0">
                  {dates.format(new Date(entry.createdAt))}
                </time>
                {entry.model ? (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="truncate font-mono">{entry.model}</span>
                  </>
                ) : null}
              </p>
            </div>
            <p
              className={
                entry.amount.startsWith("-")
                  ? "shrink-0 text-sm tabular-nums"
                  : "shrink-0 text-sm tabular-nums text-success-foreground"
              }
            >
              {formatAiCredit(entry.amount, i18n.language, {
                maxDigits: 6,
                signed: true,
              })}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
