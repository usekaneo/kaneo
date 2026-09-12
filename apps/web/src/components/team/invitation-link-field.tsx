import { CheckIcon, CopyIcon } from "lucide-react";
import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { useCopyInvitationLink } from "@/hooks/use-copy-invitation-link";
import { buildInvitationLink } from "@/lib/invitation-link";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

type Props = {
  invitationId: string;
};

function InvitationLinkField({ invitationId }: Props) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const { copy, copied } = useCopyInvitationLink();

  return (
    <div className="flex items-center gap-2">
      <Input
        ref={inputRef}
        value={buildInvitationLink(invitationId)}
        readOnly
        aria-label={t("team:invitations.linkLabel")}
        className="font-mono text-xs"
        onFocus={(event) => event.currentTarget.select()}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="shrink-0 gap-1.5"
        onClick={() => copy(invitationId, inputRef.current)}
      >
        {copied ? (
          <>
            <CheckIcon className="size-3 text-success-foreground" />
            {t("team:invitations.linkCopied")}
          </>
        ) : (
          <>
            <CopyIcon className="size-3" />
            {t("team:invitations.copyLink")}
          </>
        )}
      </Button>
    </div>
  );
}

export default InvitationLinkField;
