import { Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useGetInvitationDetails } from "@/hooks/queries/invitation/use-get-invitation-details";

type InvitationNoticeProps = {
  invitationId: string;
  description: string;
};

export function InvitationNotice({
  invitationId,
  description,
}: InvitationNoticeProps) {
  const { t } = useTranslation();
  const { data } = useGetInvitationDetails(invitationId);
  const invitation = data?.valid ? data.invitation : undefined;

  return (
    <Alert role="note">
      <Users />
      <AlertTitle>
        {invitation
          ? t("auth:signIn.invitation.title", {
              inviterName: invitation.inviterName,
              workspaceName: invitation.workspaceName,
            })
          : t("auth:signIn.invitation.fallbackTitle")}
      </AlertTitle>
      <AlertDescription>{description}</AlertDescription>
    </Alert>
  );
}
