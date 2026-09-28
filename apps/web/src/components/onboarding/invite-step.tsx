import { Plus } from "lucide-react";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  INITIAL_INVITE_FIELDS,
  MAX_INVITE_FIELDS,
} from "@/constants/onboarding";
import useInviteWorkspaceUser from "@/hooks/mutations/workspace-user/use-invite-workspace-user";
import { parseInviteEmails } from "@/lib/invite-emails";
import { toast } from "@/lib/toast";
import { InviteEmailField } from "./invite-email-field";

type InviteStepProps = {
  workspaceId: string;
  onDone: () => void;
};

export function InviteStep({ workspaceId, onDone }: InviteStepProps) {
  const { t } = useTranslation();
  const { mutateAsync: invite } = useInviteWorkspaceUser();
  const [emails, setEmails] = useState<string[]>(() =>
    Array(INITIAL_INVITE_FIELDS).fill(""),
  );
  const [invalid, setInvalid] = useState<Set<number>>(new Set());
  const [isSending, setIsSending] = useState(false);
  const [isRetry, setIsRetry] = useState(false);
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

    const parsed = parseInviteEmails(emails);
    if (!parsed.ok) {
      setInvalid(new Set(parsed.invalidIndexes));
      document
        .getElementById(`${idPrefix}-${parsed.invalidIndexes[0]}`)
        ?.focus();
      return;
    }
    if (parsed.emails.length === 0) {
      onDone();
      return;
    }

    setIsSending(true);
    const results = await Promise.allSettled(
      parsed.emails.map((email) =>
        invite({
          email,
          workspaceId,
          role: "member",
          resend: isRetry || undefined,
        }),
      ),
    );
    setIsSending(false);

    const sent = results.filter((r) => r.status === "fulfilled").length;
    if (sent > 0) {
      toast.success(t("auth:onboarding.cloud.invite.sent", { count: sent }));
    }
    const failed: string[] = [];
    results.forEach((result, i) => {
      if (result.status === "rejected") {
        failed.push(parsed.emails[i]);
        toast.error(
          t("auth:onboarding.cloud.invite.failed", {
            email: parsed.emails[i],
            message:
              result.reason instanceof Error
                ? result.reason.message
                : String(result.reason),
          }),
        );
      }
    });

    if (failed.length > 0) {
      setEmails(failed);
      setInvalid(new Set());
      setIsRetry(true);
      return;
    }

    onDone();
  };

  return (
    <form onSubmit={onSubmit} className="space-y-3" noValidate>
      {emails.map((email, index) => {
        const id = `${idPrefix}-${index}`;
        return (
          <InviteEmailField
            key={id}
            id={id}
            position={index + 1}
            value={email}
            invalid={invalid.has(index)}
            autoFocus={index === 0}
            removable={emails.length > 1}
            disabled={isSending}
            onChange={(value) => update(index, value)}
            onRemove={() => remove(index)}
          />
        );
      })}

      {emails.length < MAX_INVITE_FIELDS ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="-ml-2"
          disabled={isSending}
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
