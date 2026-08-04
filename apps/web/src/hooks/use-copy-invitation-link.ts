import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { copyToClipboard } from "@/lib/copy-to-clipboard";
import { buildInvitationLink } from "@/lib/invitation-link";
import { toast } from "@/lib/toast";

const COPIED_RESET_MS = 2000;

/**
 * Copy behaviour shared by the invite modal and the members table row menu.
 *
 * `fallbackInput` is optional because the row menu has no input to select; when
 * present and copying failed outright, the text is selected so Ctrl+C works.
 */
export function useCopyInvitationLink() {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const copy = useCallback(
    async (invitationId: string, fallbackInput?: HTMLInputElement | null) => {
      const link = buildInvitationLink(invitationId);
      const ok = await copyToClipboard(link);

      if (!ok) {
        fallbackInput?.select();
        toast.error(t("team:invitations.copyFailed"));
        return;
      }

      setCopied(true);
      toast.success(t("team:invitations.linkCopied"));
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), COPIED_RESET_MS);
    },
    [t],
  );

  return { copy, copied };
}
