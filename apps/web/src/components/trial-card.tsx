import { Link } from "@tanstack/react-router";
import { Sparkles, TriangleAlert, X } from "lucide-react";
import { useState } from "react";
import { useGetBilling } from "@/hooks/queries/billing/use-get-billing";
import useActiveWorkspace from "@/hooks/queries/workspace/use-active-workspace";
import { cn } from "@/lib/cn";

function daysLeft(value: string | null | undefined) {
  if (!value) return null;
  const ms = new Date(value).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}

const DISMISS_KEY = "kaneo:trial-card-dismissed";

export function TrialCard() {
  const { data: workspace } = useActiveWorkspace();
  const { data: billing } = useGetBilling(workspace?.id);
  const [dismissed, setDismissed] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(DISMISS_KEY) ?? "[]");
    } catch {
      return [];
    }
  });

  if (!billing?.billingEnabled || billing.foundingFree) {
    return null;
  }

  const hasSubscription = Boolean(billing.plan && billing.status);
  if (hasSubscription || !billing.trialEndsAt || !workspace?.id) {
    return null;
  }

  const left = daysLeft(billing.trialEndsAt);
  const expired = left === 0;

  // Dismissal is remembered per workspace, but an expired trial always shows
  // since that is the moment a plan is actually required.
  if (!expired && dismissed.includes(workspace.id)) {
    return null;
  }

  const dismiss = () => {
    const next = [...dismissed, workspace.id];
    setDismissed(next);
    try {
      localStorage.setItem(DISMISS_KEY, JSON.stringify(next));
    } catch {}
  };

  return (
    <div
      className={cn(
        "relative rounded-md border p-2.5 text-xs",
        expired
          ? "border-warning/30 bg-warning/10 text-warning-foreground"
          : "border-info/30 bg-info/10 text-info-foreground",
      )}
    >
      {!expired ? (
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="absolute top-1.5 right-1.5 rounded p-0.5 opacity-60 transition-opacity hover:opacity-100"
        >
          <X className="size-3" />
        </button>
      ) : null}

      <div className="flex items-center gap-1.5 font-medium">
        {expired ? (
          <TriangleAlert className="size-3.5 shrink-0" />
        ) : (
          <Sparkles className="size-3.5 shrink-0" />
        )}
        <span>
          {expired
            ? "Trial ended"
            : `${left} ${left === 1 ? "day" : "days"} left in trial`}
        </span>
      </div>
      <p className="mt-1 text-[0.7rem] leading-snug opacity-80">
        {expired
          ? "Subscribe to keep creating and editing."
          : "Upgrade anytime to keep your workspace after the trial."}
      </p>
      <Link
        to="/dashboard/settings/workspace/billing"
        className="mt-2 inline-flex font-medium underline underline-offset-2 hover:no-underline"
      >
        {expired ? "Choose a plan" : "View plans"}
      </Link>
    </div>
  );
}
