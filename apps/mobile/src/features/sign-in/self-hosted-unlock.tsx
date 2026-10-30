import { useQuery } from "@tanstack/react-query";
import { Server } from "lucide-react-native";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";

import { Txt } from "@/components/text";
import { Button } from "@/components/ui";
import { userMessage } from "@/lib/api/client";
import { i18n } from "@/lib/i18n";
import {
  buySelfHostedUnlock,
  restoreSelfHostedUnlock,
  selfHostedPackage,
} from "@/lib/purchases";
import { useColors } from "@/theme";

export function SelfHostedUnlock({
  serverUrl,
  onUnlocked,
}: {
  serverUrl: string;
  onUnlocked: () => void;
}) {
  const c = useColors();
  const { t } = useTranslation(["mobile"]);
  const offer = useQuery({
    queryKey: ["purchases", "self-hosted"],
    queryFn: selfHostedPackage,
  });
  const [busy, setBusy] = useState<"buy" | "restore" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const attempt = async (
    kind: "buy" | "restore",
    action: () => Promise<boolean>,
  ) => {
    setBusy(kind);
    setError(null);
    try {
      if (await action()) onUnlocked();
      else if (kind === "restore")
        setError(i18n.t("mobile:signIn.unlock.nothingToRestore"));
    } catch (e) {
      setError(userMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const pkg = offer.data;
  const unavailable = offer.isError || (offer.isSuccess && !pkg);
  const shownError =
    error ?? (unavailable ? t("mobile:signIn.unlock.unavailable") : null);

  return (
    <View style={{ gap: 28, paddingTop: 20 }}>
      <View style={{ gap: 8 }}>
        <Txt variant="title">{t("mobile:signIn.unlock.title")}</Txt>
        <Txt variant="body" tone="muted" style={{ lineHeight: 22 }}>
          {t("mobile:signIn.unlock.message")}
        </Txt>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Server size={14} color={c.muted} strokeWidth={2} />
        <Txt variant="monoMd" tone="ink2" style={{ flex: 1 }} numberOfLines={1}>
          {serverUrl.replace(/^https?:\/\//, "")}
        </Txt>
      </View>
      {shownError ? (
        <Txt variant="meta" tone="danger" style={{ lineHeight: 18 }}>
          {shownError}
        </Txt>
      ) : null}
      <View style={{ gap: 12 }}>
        <Button
          label={
            pkg
              ? t("mobile:signIn.unlock.buy", {
                  price: pkg.product.priceString,
                })
              : t("mobile:signIn.unlock.buyNoPrice")
          }
          disabled={!pkg || busy === "restore"}
          loading={offer.isPending || busy === "buy"}
          onPress={() => pkg && attempt("buy", () => buySelfHostedUnlock(pkg))}
        />
        <Button
          kind="secondary"
          label={t("mobile:signIn.unlock.restore")}
          disabled={busy === "buy"}
          loading={busy === "restore"}
          onPress={() => attempt("restore", restoreSelfHostedUnlock)}
        />
      </View>
    </View>
  );
}
