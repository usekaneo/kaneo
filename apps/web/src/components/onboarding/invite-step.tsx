import { Plus, SendIcon } from "lucide-react";
import { useEffect, useId, useState } from "react";
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
  onEmailsChange: (emails: string[]) => void;
  onDone: (sent: number) => void;
};

export function InviteStep({
  workspaceId,
  onEmailsChange,
  onDone,
}: InviteStepProps) {
  const { t } = useTranslation();
  const { mutateAsync: invite } = useInviteWorkspaceUser();
  const [emails, setEmails] = useState<string[]>(() =>
    Array(INITIAL_INVITE_FIELDS).fill(""),
  );
  const [invalid, setInvalid] = useState<Set<number>>(new Set());
  const [isSending, setIsSending] = useState(false);
  const [isRetry, setIsRetry] = useState(false);
  const [sentSoFar, setSentSoFar] = useState(0);
  const idPrefix = useId();
  const filled = emails.filter((email) => email.trim()).length;

  useEffect(() => {
    onEmailsChange(emails);
  }, [emails, onEmailsChange]);

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
      onDone(sentSoFar);
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
      toast.success(t("auth:onboarding.cloud.invite.sent", { count: sent }), {
        icon: SendIcon,
      });
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
      setSentSoFar((current) => current + sent);
      setEmails(failed);
      setInvalid(new Set());
      setIsRetry(true);
      return;
    }

    onDone(sentSoFar + sent);
  };

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6" noValidate>
      <div className="flex flex-col gap-2">
        <p className="font-medium text-foreground text-sm leading-4">
          {t("auth:onboarding.invite.label")}
        </p>
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
            className="-ms-2 self-start text-muted-foreground"
            disabled={isSending}
            onClick={() => setEmails((current) => [...current, ""])}
          >
            <Plus />
            {t("auth:onboarding.cloud.invite.addAnother")}
          </Button>
        ) : null}
      </div>
      <div className="flex items-center justify-between gap-3">
        <Button
          type="submit"
          size="lg"
          loading={isSending}
          disabled={filled === 0}
        >
          {filled > 0
            ? t("auth:onboarding.invite.send", { count: filled })
            : t("auth:onboarding.invite.sendNone")}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="lg"
          className="text-muted-foreground"
          disabled={isSending}
          onClick={() => onDone(sentSoFar)}
        >
          {t("auth:onboarding.cloud.invite.skip")}
        </Button>
      </div>
    </form>
  );
}
