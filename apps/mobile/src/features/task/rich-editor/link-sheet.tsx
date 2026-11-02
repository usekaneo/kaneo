import { useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";

import { Sheet } from "@/components/sheet";
import { Button, TextField } from "@/components/ui";

export function LinkSheet({
  visible,
  current,
  onClose,
  onApply,
}: {
  visible: boolean;
  current: string | null;
  onClose: () => void;
  onApply: (href: string | null) => void;
}) {
  const { t } = useTranslation(["mobile"]);
  return (
    <Sheet visible={visible} onClose={onClose} title={t("mobile:editor.link")}>
      {visible ? (
        <LinkForm
          current={current}
          onApply={(href) => {
            onApply(href);
            onClose();
          }}
        />
      ) : null}
    </Sheet>
  );
}

function LinkForm({
  current,
  onApply,
}: {
  current: string | null;
  onApply: (href: string | null) => void;
}) {
  const { t } = useTranslation(["mobile"]);
  const [url, setUrl] = useState(current ?? "");
  const href = url.trim();
  const normalized = /^[a-z][a-z0-9+.-]*:/i.test(href)
    ? href
    : `https://${href}`;

  return (
    <View style={{ paddingHorizontal: 20, paddingBottom: 12, gap: 12 }}>
      <TextField
        label={t("mobile:editor.linkUrl")}
        value={url}
        onChangeText={setUrl}
        placeholder="https://"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        autoFocus
        returnKeyType="done"
        onSubmitEditing={() => href && onApply(normalized)}
      />
      <Button
        label={t("mobile:editor.applyLink")}
        disabled={!href}
        onPress={() => onApply(normalized)}
      />
      {current ? (
        <Button
          label={t("mobile:editor.removeLink")}
          kind="dangerOutline"
          onPress={() => onApply(null)}
        />
      ) : null}
    </View>
  );
}
