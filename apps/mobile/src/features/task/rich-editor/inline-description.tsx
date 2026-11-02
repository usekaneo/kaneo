import { memo, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { LogBox, View, type LayoutChangeEvent } from "react-native";

import { useSession } from "@/lib/session";
import { useColors } from "@/theme";

import type { EditorTheme } from "./editor-theme";
import RichEditorDom from "./rich-editor-dom";
import type { RichDescription } from "./use-rich-description";

LogBox.ignoreLogs(["Unable to find the 'DomWebView' view"]);

export const InlineDescription = memo(function InlineDescription({
  description,
  editor,
  onLayout,
}: {
  description: string;
  editor: RichDescription;
  onLayout?: (event: LayoutChangeEvent) => void;
}) {
  const { t } = useTranslation(["mobile"]);
  const c = useColors();
  const session = useSession();
  const theme = useMemo<EditorTheme>(
    () => ({
      surface: c.surface,
      ink: c.ink,
      body: c.body,
      ink2: c.ink2,
      muted: c.muted,
      faint: c.faint,
      placeholder: c.placeholder,
      link: c.link,
      hairline: c.hairline,
      fill: c.fill,
      fillStrong: c.fillStrong,
      primary: c.primary,
      onPrimary: c.onPrimary,
      selection: `${c.link}33`,
    }),
    [c],
  );

  return (
    <View onLayout={onLayout} style={{ minHeight: 24 }}>
      <RichEditorDom
        ref={editor.ref}
        markdown={description}
        serverUrl={session?.serverUrl ?? ""}
        theme={theme}
        placeholder={t("mobile:taskDetail.screen.addDescription")}
        attachmentLabel={t("mobile:editor.attachment")}
        onChange={editor.onChange}
        onFormatChange={editor.onFormatChange}
        onFocusChange={editor.onFocusChange}
        dom={{
          matchContents: true,
          scrollEnabled: false,
          hideKeyboardAccessoryView: true,
          style: { backgroundColor: c.surface },
        }}
      />
    </View>
  );
});
