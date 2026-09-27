import { Plus, X } from "lucide-react";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { z } from "zod/v4";
import {
  type BillingPlanKey,
  PlanPicker,
} from "@/components/billing/plan-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import useInviteWorkspaceUser from "@/hooks/mutations/workspace-user/use-invite-workspace-user";
import { useGetBilling } from "@/hooks/queries/billing/use-get-billing";
import { getTrialState } from "@/lib/billing";
import { cn } from "@/lib/cn";
import { toast } from "@/lib/toast";

export type WorkspaceUsage = "solo" | "team";

export function UsagePicker({
  value,
  onChange,
}: {
  value: WorkspaceUsage;
  onChange: (value: WorkspaceUsage) => void;
}) {
  const { t } = useTranslation();
  const name = useId();
  const options: { value: WorkspaceUsage; label: string; hint: string }[] = [
    {
      value: "team",
      label: t("auth:onboarding.cloud.usageTeam"),
      hint: t("auth:onboarding.cloud.usageTeamDescription"),
    },
    {
      value: "solo",
      label: t("auth:onboarding.cloud.usageSolo"),
      hint: t("auth:onboarding.cloud.usageSoloDescription"),
    },
  ];

  return (
    <fieldset className="space-y-2">
      <legend className="mb-2 text-sm font-medium">
        {t("auth:onboarding.cloud.usageLabel")}
      </legend>
      <div className="grid grid-cols-2 gap-2">
        {options.map((option) => (
          <label
            key={option.value}
            className={cn(
              "cursor-pointer rounded-md border p-3 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
              value === option.value
                ? "border-primary/60 bg-primary/5"
                : "border-border hover:bg-muted/50",
            )}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              className="sr-only"
            />
            <span className="block text-sm font-medium">{option.label}</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              {option.hint}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

const MAX_INVITES = 10;
const emailSchema = z.email();

export function InviteStep({
  workspaceId,
  onDone,
}: {
  workspaceId: string;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const { mutateAsync: invite } = useInviteWorkspaceUser();
  const [emails, setEmails] = useState(["", "", ""]);
  const [invalid, setInvalid] = useState<Set<number>>(new Set());
  const [isSending, setIsSending] = useState(false);
  const idPrefix = useId();

  const update = (index: number, value: string) => {
    setEmails((current) => current.map((e, i) => (i === index ? value : e)));
    setInvalid((current) => {
      if (!current.has(index)) return current;
      const next = new Set(current);
      next.delete(index);
      return next;
    });
  };

  const remove = (index: number) => {
    setEmails((current) => current.filter((_, i) => i !== index));
    setInvalid(new Set());
  };

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const filled = emails
      .map((email, index) => ({ email: email.trim(), index }))
      .filter(({ email }) => email);

    const bad = filled.filter(
      ({ email }) => !emailSchema.safeParse(email).success,
    );
    if (bad.length > 0) {
      setInvalid(new Set(bad.map(({ index }) => index)));
      return;
    }

    const unique = [...new Set(filled.map(({ email }) => email.toLowerCase()))];
    if (unique.length === 0) {
      onDone();
      return;
    }

    setIsSending(true);
    const results = await Promise.allSettled(
      unique.map((email) => invite({ email, workspaceId, role: "member" })),
    );
    setIsSending(false);

    const sent = results.filter((r) => r.status === "fulfilled").length;
    if (sent > 0) {
      toast.success(t("auth:onboarding.cloud.invite.sent", { count: sent }));
    }
    results.forEach((result, i) => {
      if (result.status === "rejected") {
        toast.error(
          t("auth:onboarding.cloud.invite.failed", {
            email: unique[i],
            message:
              result.reason instanceof Error
                ? result.reason.message
                : String(result.reason),
          }),
        );
      }
    });

    onDone();
  };

  return (
    <form onSubmit={onSubmit} className="space-y-3" noValidate>
      {emails.map((email, index) => {
        const id = `${idPrefix}-${index}`;
        const label = t("auth:onboarding.cloud.invite.emailLabel", {
          index: index + 1,
        });
        const isInvalid = invalid.has(index);
        return (
          <div key={id} className="space-y-1">
            <Label htmlFor={id} className="sr-only">
              {label}
            </Label>
            <div className="flex items-center gap-2">
              <Input
                id={id}
                type="email"
                autoComplete="off"
                autoFocus={index === 0}
                placeholder={t("auth:onboarding.cloud.invite.emailPlaceholder")}
                value={email}
                aria-invalid={isInvalid || undefined}
                aria-describedby={isInvalid ? `${id}-error` : undefined}
                onChange={(event) => update(index, event.target.value)}
              />
              {emails.length > 1 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="shrink-0"
                  aria-label={t("auth:onboarding.cloud.invite.remove", {
                    index: index + 1,
                  })}
                  onClick={() => remove(index)}
                >
                  <X className="size-4" />
                </Button>
              ) : null}
            </div>
            {isInvalid ? (
              <p id={`${id}-error`} className="text-xs text-destructive">
                {t("auth:onboarding.cloud.invite.invalidEmail")}
              </p>
            ) : null}
          </div>
        );
      })}

      {emails.length < MAX_INVITES ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="-ml-2"
          onClick={() => setEmails((current) => [...current, ""])}
        >
          <Plus className="size-4" />
          {t("auth:onboarding.cloud.invite.addAnother")}
        </Button>
      ) : null}

      <div className="flex flex-col gap-2 pt-3">
        <Button type="submit" disabled={isSending} className="w-full">
          {isSending
            ? t("auth:onboarding.cloud.invite.sending")
            : t("auth:onboarding.cloud.invite.send")}
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={isSending}
          className="w-full"
          onClick={onDone}
        >
          {t("auth:onboarding.cloud.invite.skip")}
        </Button>
      </div>
    </form>
  );
}

export function PlanStep({
  workspaceId,
  usage,
  onContinue,
}: {
  workspaceId: string;
  usage: WorkspaceUsage;
  onContinue: () => void;
}) {
  const { t } = useTranslation();
  const { data: billing, isPending } = useGetBilling(workspaceId);

  if (isPending) {
    return <Spinner className="mx-auto h-6 w-6 text-muted-foreground" />;
  }

  const trial = getTrialState(billing);
  const recommended: BillingPlanKey = usage === "solo" ? "personal" : "team";

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        {trial.kind === "active"
          ? t("auth:onboarding.cloud.plan.trialActive", {
              date: new Date(trial.endsAt).toLocaleDateString(undefined, {
                month: "long",
                day: "numeric",
              }),
            })
          : t("auth:onboarding.cloud.plan.trialUsed")}
      </p>

      <PlanPicker
        workspaceId={workspaceId}
        canManage
        highlighted={recommended}
        highlightLabel={t("auth:onboarding.cloud.plan.recommended")}
        compact
      />

      <div className="space-y-2">
        <Button
          type="button"
          variant={trial.kind === "active" ? "secondary" : "ghost"}
          className="w-full"
          onClick={onContinue}
        >
          {trial.kind === "active"
            ? t("auth:onboarding.cloud.plan.continueTrial")
            : t("auth:onboarding.cloud.plan.continueWithoutPlan")}
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          {t("auth:onboarding.cloud.plan.note")}
        </p>
      </div>
    </div>
  );
}
