import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";

import { Sheet } from "@/components/sheet";
import { Txt } from "@/components/text";
import { useToast } from "@/components/toast";
import { Button, TextField } from "@/components/ui";
import { ApiError, userMessage } from "@/lib/api/client";
import { api } from "@/lib/api/endpoints";
import { sessionStore } from "@/lib/session";

import { isDeleteConfirmationValid } from "./is-delete-confirmation-valid";

function errorCode(error: unknown): string | undefined {
  if (!(error instanceof ApiError)) return undefined;
  const body = error.body as { code?: unknown } | null | undefined;
  return typeof body?.code === "string" ? body.code : undefined;
}

export function DeleteAccountSheet({
  visible,
  email,
  onClose,
}: {
  visible: boolean;
  email: string;
  onClose: () => void;
}) {
  const { t } = useTranslation(["mobile"]);
  const client = useQueryClient();
  const toast = useToast();
  const [confirmation, setConfirmation] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const close = () => {
    if (busy) return;
    setConfirmation("");
    setPassword("");
    setError(null);
    onClose();
  };

  const remove = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.deleteUser(password ? { password } : {});
      toast.show(t("mobile:account.deleteAccount.success"), "success");
      await sessionStore.clear();
      client.clear();
    } catch (e) {
      const code = errorCode(e);
      setError(
        code === "SESSION_EXPIRED"
          ? t("mobile:account.deleteAccount.sessionTooOld")
          : code === "INVALID_PASSWORD"
            ? t("mobile:account.deleteAccount.wrongPassword")
            : code === "CREDENTIAL_ACCOUNT_NOT_FOUND"
              ? t("mobile:account.deleteAccount.noPassword")
              : userMessage(e),
      );
      setBusy(false);
    }
  };

  return (
    <Sheet
      visible={visible}
      onClose={close}
      title={t("mobile:account.deleteAccount.modalTitle")}
    >
      <View style={{ paddingHorizontal: 20, paddingBottom: 12, gap: 14 }}>
        <Txt variant="bodySm" tone="muted">
          {t("mobile:account.deleteAccount.modalDescription")}
        </Txt>
        <TextField
          label={t("mobile:account.deleteAccount.confirmLabel", { email })}
          value={confirmation}
          onChangeText={setConfirmation}
          placeholder={email}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          editable={!busy}
        />
        <TextField
          label={t("mobile:account.deleteAccount.password")}
          hint={t("mobile:account.deleteAccount.passwordHint")}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          editable={!busy}
          error={error}
        />
        <Button
          label={t("mobile:account.deleteAccount.confirm")}
          kind="danger"
          loading={busy}
          disabled={!isDeleteConfirmationValid(confirmation, email)}
          onPress={remove}
        />
      </View>
    </Sheet>
  );
}
