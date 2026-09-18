import { CheckCircle2, ChevronDown, CircleAlert, X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/cn";

export type UploadItem = {
  id: string;
  name: string;
  folder: string;
  progress: number;
  status: "queued" | "uploading" | "done" | "error";
  error?: string;
};

export function UploadQueue({
  items,
  onDismiss,
}: {
  items: UploadItem[];
  onDismiss: () => void;
}) {
  const { t } = useTranslation();
  const [collapsed, setCollapsed] = useState(false);
  if (items.length === 0) return null;

  const active = items.filter(
    (i) => i.status === "queued" || i.status === "uploading",
  ).length;
  const failed = items.filter((i) => i.status === "error").length;
  const total = items.reduce((sum, i) => sum + i.progress, 0) / items.length;

  return (
    <div className="fixed right-4 bottom-4 z-50 w-80 overflow-hidden rounded-xl border border-border bg-popover shadow-lg">
      <div className="flex items-center gap-2 border-border border-b px-3 py-2">
        <p className="flex-1 truncate font-medium text-sm">
          {active > 0
            ? t("files:uploading", { count: active })
            : failed > 0
              ? t("files:uploadFailedCount", { count: failed })
              : t("files:uploaded", { count: items.length })}
        </p>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={
            collapsed ? t("files:queue.expand") : t("files:queue.collapse")
          }
          onClick={() => setCollapsed((c) => !c)}
        >
          <ChevronDown
            className={cn(
              "size-4 transition-transform",
              collapsed && "-rotate-180",
            )}
          />
        </Button>
        {active === 0 && (
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={t("files:queue.close")}
            onClick={onDismiss}
          >
            <X className="size-4" />
          </Button>
        )}
      </div>
      {active > 0 && (
        <Progress value={Math.round(total * 100)} className="gap-0" />
      )}
      {!collapsed && (
        <ul className="max-h-64 divide-y divide-border overflow-y-auto">
          {items.map((item) => (
            <li key={item.id} className="space-y-1.5 px-3 py-2">
              <div className="flex items-center gap-2 text-sm">
                <span className="min-w-0 flex-1 truncate" title={item.name}>
                  {item.name}
                </span>
                {item.status === "done" && (
                  <CheckCircle2 className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                )}
                {item.status === "error" && (
                  <CircleAlert className="size-4 shrink-0 text-destructive" />
                )}
                {item.status === "uploading" && (
                  <span className="shrink-0 text-muted-foreground text-xs tabular-nums">
                    {Math.round(item.progress * 100)}%
                  </span>
                )}
              </div>
              {item.status === "error" ? (
                <p
                  className="truncate text-destructive text-xs"
                  title={item.error}
                >
                  {item.error}
                </p>
              ) : item.status !== "done" ? (
                <Progress value={Math.round(item.progress * 100)} />
              ) : item.folder ? (
                <p className="truncate text-muted-foreground text-xs">
                  {item.folder}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
