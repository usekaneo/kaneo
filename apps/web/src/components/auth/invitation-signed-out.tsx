import { UserPlus } from "lucide-react";
import { Trans, useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

type InvitationSignedOutProps = {
  workspaceName: string;
  inviterName: string;
  email: string;
  onCreateAccount: () => void;
  onSignIn: () => void;
};

export function InvitationSignedOut({
  workspaceName,
  inviterName,
  email,
  onCreateAccount,
  onSignIn,
}: InvitationSignedOutProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center justify-center w-12 h-12 mx-auto bg-primary/10 rounded-full">
        <UserPlus className="w-6 h-6 text-primary" />
      </div>

      <div className="space-y-3 text-center">
        <h2 className="text-lg font-semibold text-foreground">
          {t("auth:invitation.joinWorkspace", { workspaceName })}
        </h2>
        <p className="text-sm text-muted-foreground">
          <Trans
            i18nKey="auth:invitation.inviteBodySignedOut"
            values={{ inviterName }}
            components={{ inviter: <strong /> }}
          />
        </p>
        <p className="text-sm text-muted-foreground">
          {t("auth:invitation.createAccountToAccept")}
        </p>
      </div>

      <div className="space-y-3 pt-2">
        <Button onClick={onCreateAccount} className="w-full">
          <UserPlus className="w-4 h-4 mr-2" />
          {t("auth:invitation.createAccount")}
        </Button>
        <p className="text-sm text-center text-muted-foreground">
          {t("auth:invitation.alreadyHaveAccount")}{" "}
          <button
            type="button"
            onClick={onSignIn}
            className="underline underline-offset-4 hover:text-primary"
          >
            {t("auth:invitation.signIn")}
          </button>
        </p>
      </div>

      <div className="pt-4 border-t border-border">
        <div className="text-center space-y-1">
          <p className="text-xs text-muted-foreground">
            <Trans
              i18nKey="auth:invitation.invitationFor"
              values={{ email }}
              components={{ email: <strong /> }}
            />
          </p>
        </div>
      </div>
    </div>
  );
}
