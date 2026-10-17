import {
  createFileRoute,
  useNavigate,
  useSearch,
} from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { z } from "zod/v4";
import { authMessageClassName } from "@/components/auth/auth-form-styles";
import { AuthPage } from "@/components/auth/auth-page";
import { normalizeDeviceCode } from "@/components/auth/device-code";
import PageTitle from "@/components/page-title";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";

const MIN_CODE_LENGTH = 4;

const deviceSearchSchema = z.object({
  user_code: z.string().optional(),
});

export const Route = createFileRoute("/device/")({
  component: DevicePage,
  validateSearch: deviceSearchSchema,
});

function DevicePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const search = useSearch({ from: "/device/" });
  const [code, setCode] = useState(search.user_code?.toUpperCase() ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const userCode = normalizeDeviceCode(code);
    if (userCode.length < MIN_CODE_LENGTH) {
      setError(t("auth:device.connect.codeRequired"));
      return;
    }
    setIsPending(true);
    setError(null);
    try {
      const result = await authClient.device({
        query: { user_code: userCode },
      });
      if (result.error) {
        setError(t("auth:device.connect.invalidCode"));
        setIsPending(false);
        return;
      }
      void navigate({ to: "/device/approve", search: { user_code: userCode } });
    } catch {
      setError(t("auth:device.connect.invalidCode"));
      setIsPending(false);
    }
  };

  return (
    <>
      <PageTitle title={t("auth:device.connect.title")} />
      <AuthPage
        title={t("auth:device.connect.title")}
        description={t("auth:device.connect.description")}
      >
        <form onSubmit={onSubmit} className="flex flex-col gap-3" noValidate>
          <div className="flex flex-col gap-2">
            <Label htmlFor="device-code">
              {t("auth:device.connect.label")}
            </Label>
            <Input
              id="device-code"
              size="lg"
              value={code}
              onChange={(event) => {
                setCode(event.target.value.toUpperCase());
                setError(null);
              }}
              placeholder="ABCD-1234"
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              autoFocus={!search.user_code}
              className="font-mono tracking-[0.08em]"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "device-code-error" : undefined}
            />
            {error ? (
              <p
                id="device-code-error"
                role="alert"
                className={authMessageClassName}
              >
                {error}
              </p>
            ) : null}
          </div>
          <Button
            type="submit"
            size="lg"
            className="w-full"
            loading={isPending}
          >
            {t("auth:device.connect.submit")}
          </Button>
        </form>
        <p className="pt-8 text-muted-foreground text-sm">
          {t("auth:device.connect.noCode")}
        </p>
      </AuthPage>
    </>
  );
}
