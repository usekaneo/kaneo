import { ChevronDown, ChevronRight, Monitor } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  useActivitySpans,
  useActivitySummary,
} from "@/hooks/queries/agent/use-agent";
import useCompanySettings from "@/hooks/queries/company/use-company-settings";
import { formatHours } from "@/lib/format-duration";
import { addDaysToDay, zonedClock, zonedDay } from "@/lib/zoned-time";

type Range = "today" | "week" | "month";

function rangeFor(range: Range, today: string) {
  if (range === "today") return { from: today, to: today };
  if (range === "month") return { from: `${today.slice(0, 7)}-01`, to: today };
  const weekday = new Date(`${today}T12:00:00Z`).getUTCDay() || 7;
  return { from: addDaysToDay(today, 1 - weekday), to: today };
}

function UsageList({
  title,
  items,
  total,
}: {
  title: string;
  items: { name: string; seconds: number }[];
  total: number;
}) {
  const { t } = useTranslation();
  const [all, setAll] = useState(false);
  const shown = all ? items : items.slice(0, 8);
  if (items.length === 0) return null;

  return (
    <section className="space-y-2">
      <h3 className="text-xs font-medium text-muted-foreground">{title}</h3>
      <ul className="space-y-1.5">
        {shown.map((item) => (
          <li key={item.name} className="text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="truncate">{item.name}</span>
              <span className="shrink-0 tabular-nums text-muted-foreground">
                {formatHours(item.seconds)}
              </span>
            </div>
            <div className="mt-1 h-1 rounded-full bg-muted">
              <div
                className="h-1 rounded-full bg-foreground/40"
                style={{
                  width: `${Math.max(2, Math.round((item.seconds / Math.max(total, 1)) * 100))}%`,
                }}
              />
            </div>
          </li>
        ))}
      </ul>
      {items.length > 8 && (
        <button
          type="button"
          className="text-xs text-muted-foreground hover:text-foreground"
          onClick={() => setAll((v) => !v)}
        >
          {all
            ? t("desktopActivity:showLess")
            : t("desktopActivity:showAll", { count: items.length })}
        </button>
      )}
    </section>
  );
}

function Details({
  workspaceId,
  userId,
  day,
  timeZone,
}: {
  workspaceId: string;
  userId?: string;
  day: string;
  timeZone: string;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const { data: spans = [] } = useActivitySpans(
    { workspaceId, userId, day },
    open,
  );

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          {open ? (
            <ChevronDown className="size-4" />
          ) : (
            <ChevronRight className="size-4" />
          )}
          {t("desktopActivity:details", { day })}
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        {spans.length === 0 ? (
          <p className="px-5 py-2 text-xs text-muted-foreground">
            {t("desktopActivity:noDetails")}
          </p>
        ) : (
          <ul className="mt-2 max-h-80 overflow-y-auto rounded-md border border-border text-xs">
            {spans.map((span) => (
              <li
                key={`${span.startedAt}-${span.app}`}
                className="flex gap-3 border-b border-border px-3 py-1 last:border-0"
              >
                <span className="w-24 shrink-0 tabular-nums text-muted-foreground">
                  {zonedClock(span.startedAt, timeZone)}–
                  {zonedClock(span.endedAt, timeZone)}
                </span>
                <span className="w-12 shrink-0 text-muted-foreground">
                  {span.state === "idle"
                    ? t("desktopActivity:idle")
                    : t("desktopActivity:active")}
                </span>
                <span className="truncate">
                  {[span.app, span.domain].filter(Boolean).join(" · ") || "–"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

// What the desktop app recorded, summed up: active and idle time, and where
// the active time went. Facts only; no scores.
export function ActivityView({
  workspaceId,
  userId,
}: {
  workspaceId: string;
  userId?: string;
}) {
  const { t } = useTranslation();
  const { data: company } = useCompanySettings(workspaceId);
  const timeZone = company?.timezone ?? "UTC";
  const today = zonedDay(new Date(), timeZone);
  const [range, setRange] = useState<Range>("today");
  const bounds = useMemo(() => rangeFor(range, today), [range, today]);
  const { data } = useActivitySummary({ workspaceId, userId, ...bounds });

  const hasData = Boolean(data && data.activeSeconds + data.idleSeconds > 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ToggleGroup
          value={[range]}
          onValueChange={(value) => {
            const next = value[0] as Range | undefined;
            if (next) setRange(next);
          }}
        >
          <ToggleGroupItem value="today" size="sm">
            {t("desktopActivity:range.today")}
          </ToggleGroupItem>
          <ToggleGroupItem value="week" size="sm">
            {t("desktopActivity:range.week")}
          </ToggleGroupItem>
          <ToggleGroupItem value="month" size="sm">
            {t("desktopActivity:range.month")}
          </ToggleGroupItem>
        </ToggleGroup>
        {data && (
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground tabular-nums">
              {formatHours(data.activeSeconds)}
            </span>{" "}
            {t("desktopActivity:active")}
            {" · "}
            <span className="tabular-nums">
              {formatHours(data.idleSeconds)}
            </span>{" "}
            {t("desktopActivity:idle")}
          </p>
        )}
      </div>

      {!hasData ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia>
              <Monitor className="size-8 text-muted-foreground" />
            </EmptyMedia>
            <EmptyTitle>{t("desktopActivity:emptyTitle")}</EmptyTitle>
            <EmptyDescription>
              {t("desktopActivity:emptyDescription")}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        data && (
          <div className="grid gap-8 md:grid-cols-2">
            <UsageList
              title={t("desktopActivity:apps")}
              items={data.apps}
              total={data.activeSeconds}
            />
            <UsageList
              title={t("desktopActivity:domains")}
              items={data.domains}
              total={data.activeSeconds}
            />
          </div>
        )
      )}

      <Details
        workspaceId={workspaceId}
        userId={userId}
        day={bounds.to}
        timeZone={timeZone}
      />
      <p className="text-xs text-muted-foreground">
        {t("desktopActivity:privacyNote")}
      </p>
    </div>
  );
}
