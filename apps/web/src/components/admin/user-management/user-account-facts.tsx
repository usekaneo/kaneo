import { useTranslation } from "react-i18next";
import useGetConfig from "@/hooks/queries/config/use-get-config";
import type { AdminUser } from "@/hooks/queries/admin/use-admin-users";
import {
  formatDateMedium,
  formatDateTime,
  formatRelativeTime,
} from "@/lib/format";
import { getSignInMethodLabel } from "./get-sign-in-method-label";

type UserAccountFactsProps = {
  user: AdminUser;
};

export function UserAccountFacts({ user }: UserAccountFactsProps) {
  const { t } = useTranslation();
  const { data: config } = useGetConfig();
  const methods = user.signInMethods.map((method) =>
    getSignInMethodLabel(method, t, config?.customOAuthName),
  );
  const facts = [
    {
      label: t("settings:adminUsers.details.emailStatus"),
      value: t(
        user.emailVerified
          ? "settings:adminUsers.details.verified"
          : "settings:adminUsers.details.notVerified",
      ),
    },
    {
      label: t("settings:adminUsers.details.signInMethods"),
      value:
        methods.length > 0
          ? methods.join(", ")
          : t("settings:adminUsers.details.noSignInMethods"),
    },
    {
      label: t("settings:adminUsers.columns.lastActive"),
      value: user.lastActiveAt ? (
        <time
          dateTime={user.lastActiveAt}
          title={formatDateTime(user.lastActiveAt)}
        >
          {formatRelativeTime(user.lastActiveAt)}
        </time>
      ) : (
        t("settings:adminUsers.never")
      ),
    },
    {
      label: t("settings:adminUsers.columns.joined"),
      value: formatDateMedium(user.createdAt),
    },
  ];

  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-lg border bg-muted/30 px-3.5 py-3 text-[13px]">
      {facts.map((fact) => (
        <div key={fact.label} className="contents">
          <dt className="text-muted-foreground">{fact.label}</dt>
          <dd className="min-w-0 truncate">{fact.value}</dd>
        </div>
      ))}
    </dl>
  );
}
