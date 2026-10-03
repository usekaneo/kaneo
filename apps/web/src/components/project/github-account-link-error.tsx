import { useTranslation } from "react-i18next";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function GitHubAccountLinkError({ error }: { error: string }) {
  const { t } = useTranslation();
  let message: string;
  switch (error) {
    case "email_not_found":
    case "unable_to_link_account":
      message = t("settings:githubIntegration.accountLinkErrors.emailAccess");
      break;
    case "email_doesn't_match":
      message = t("settings:githubIntegration.accountLinkErrors.emailMismatch");
      break;
    case "account_already_linked_to_different_user":
      message = t("settings:githubIntegration.accountLinkErrors.alreadyLinked");
      break;
    default:
      message = t("settings:githubIntegration.accountLinkErrors.failed");
  }

  return (
    <Alert variant="error">
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}
