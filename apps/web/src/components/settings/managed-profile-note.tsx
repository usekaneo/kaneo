import { useTranslation } from "react-i18next";
import { useProviderName } from "@/components/auth/use-provider-name";
import useGetConfig from "@/hooks/queries/config/use-get-config";

export function ManagedProfileNote() {
  const { t } = useTranslation();
  const { data: config } = useGetConfig();
  const getProviderName = useProviderName(config?.customOAuthName);
  const accountUrl = config?.customOAuthAccountUrl;

  return (
    <span>
      {t("settings:managedProfile.note")}
      {accountUrl ? (
        <>
          {" "}
          <a
            href={accountUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-foreground underline underline-offset-2"
          >
            {t("settings:managedProfile.edit", {
              provider: getProviderName("custom"),
            })}
          </a>
        </>
      ) : null}
    </span>
  );
}
