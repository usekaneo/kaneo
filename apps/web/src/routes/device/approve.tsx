import {
  createFileRoute,
  Link,
  useNavigate,
  useSearch,
} from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { z } from "zod/v4";
import { AuthFormSkeleton } from "@/components/auth/auth-form-skeleton";
import { AuthPage } from "@/components/auth/auth-page";
import { useSettledSession } from "@/components/auth/use-settled-session";
import {
  formatDeviceCode,
  normalizeDeviceCode,
} from "@/components/auth/device-code";
import PageTitle from "@/components/page-title";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { toast } from "@/lib/toast";

const approveSearchSchema = z.object({
  user_code: z.string().optional(),
});

export const Route = createFileRoute("/device/approve")({
  component: DeviceApprovePage,
  validateSearch: approveSearchSchema,
});

type Decision = "approve" | "deny";

function DeviceApprovePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const search = useSearch({ from: "/device/approve" });
  const { session, isLoading: isSessionPending } = useSettledSession();
  const [pending, setPending] = useState<Decision | null>(null);
  const [result, setResult] = useState<Decision | null>(null);
  const userCode = normalizeDeviceCode(search.user_code);
  const pageTitle = <PageTitle title={t("auth:device.approve.pageTitle")} />;

  if (result) {
    return (
      <>
        {pageTitle}
        <AuthPage
          title={
            result === "approve"
              ? t("auth:device.approved.title")
              : t("auth:device.denied.title")
          }
          description={
            <span role="status">
              {result === "approve"
                ? t("auth:device.approved.description")
                : t("auth:device.denied.description")}
            </span>
          }
        />
      </>
    );
  }

  if (isSessionPending) {
    return (
      <>
        {pageTitle}
        <AuthPage title={t("auth:device.approve.title")}>
          <AuthFormSkeleton />
        </AuthPage>
      </>
    );
  }

  if (!userCode) {
    return (
      <>
        {pageTitle}
        <AuthPage
          title={t("auth:device.missing.title")}
          description={t("auth:device.missing.description")}
        >
          <Button size="lg" className="w-full" render={<Link to="/device" />}>
            {t("auth:device.missing.enterCode")}
          </Button>
        </AuthPage>
      </>
    );
  }

  if (!session?.user) {
    return (
      <>
        {pageTitle}
        <AuthPage
          title={t("auth:device.signIn.title")}
          description={t("auth:device.signIn.description")}
        >
          <Button
            size="lg"
            className="w-full"
            onClick={() =>
              void navigate({
                to: "/auth/sign-in",
                search: {
                  redirect: `/device/approve?user_code=${encodeURIComponent(userCode)}`,
                },
              })
            }
          >
            {t("auth:device.signIn.submit")}
          </Button>
        </AuthPage>
      </>
    );
  }

  const decide = async (decision: Decision) => {
    setPending(decision);
    try {
      // better-auth >= 1.6.11 requires the signed-in user to claim the code
      // (GET /device) before it can be approved or denied. No-op if already
      // claimed.
      await authClient.device({ query: { user_code: userCode } });
      const response =
        decision === "approve"
          ? await authClient.device.approve({ userCode })
          : await authClient.device.deny({ userCode });
      if (response.error) {
        toast.error(
          response.error.error_description ?? t("auth:device.approve.failed"),
        );
        setPending(null);
        return;
      }
      setResult(decision);
    } catch {
      toast.error(t("auth:device.approve.failed"));
      setPending(null);
    }
  };

  return (
    <>
      {pageTitle}
      <AuthPage
        title={t("auth:device.approve.title")}
        description={t("auth:device.approve.description", {
          email: session.user.email,
        })}
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col items-center gap-2 rounded-xl border border-border px-4 py-5 dark:bg-input/16">
            <p className="text-muted-foreground text-xs">
              {t("auth:device.approve.matchCode")}
            </p>
            <p className="font-mono text-[22px] text-foreground leading-7 tracking-[0.12em]">
              {formatDeviceCode(userCode)}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              size="lg"
              loading={pending === "deny"}
              disabled={pending !== null}
              onClick={() => void decide("deny")}
            >
              {t("auth:device.approve.deny")}
            </Button>
            <Button
              size="lg"
              loading={pending === "approve"}
              disabled={pending !== null}
              onClick={() => void decide("approve")}
            >
              {t("auth:device.approve.approve")}
            </Button>
          </div>
        </div>
      </AuthPage>
    </>
  );
}
