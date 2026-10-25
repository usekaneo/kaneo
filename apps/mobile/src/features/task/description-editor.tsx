import {
  Bold,
  Code,
  Heading1,
  Image as ImageIcon,
  Italic,
  Link2,
  List,
} from "lucide-react-native";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  TextInput,
  View,
  type TextInputInstance,
} from "react-native";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { MarkdownText } from "@/components/markdown";
import { BackButton, Screen } from "@/components/screen";
import { Txt } from "@/components/text";
import { useToast } from "@/components/toast";
import { IconButton, Segmented, Touch } from "@/components/ui";
import { userMessage } from "@/lib/api/client";
import { uploadTaskImage } from "@/lib/upload";
import { font, useColors } from "@/theme";

/** Full-screen Markdown editor with Write/Preview and a formatting bar above the keyboard. */
export function DescriptionEditor(props: {
  visible: boolean;
  onClose: () => void;
  taskId: string;
  initial: string;
  /** Resolves true once saved; otherwise the editor stays open with the draft. */
  onSave: (text: string) => Promise<boolean>;
}) {
  return (
    <Modal
      visible={props.visible}
      animationType="slide"
      onRequestClose={props.onClose}
      statusBarTranslucent
      navigationBarTranslucent
    >
      {props.visible ? <EditorBody {...props} /> : null}
    </Modal>
  );
}

function Tool({
  label,
  onPress,
  children,
}: {
  label: string;
  onPress: () => void;
  children: ReactNode;
}) {
  return (
    <IconButton label={label} onPress={onPress} size={40}>
      {children}
    </IconButton>
  );
}

function EditorBody({
  onClose,
  taskId,
  initial,
  onSave,
}: {
  onClose: () => void;
  taskId: string;
  initial: string;
  onSave: (text: string) => Promise<boolean>;
}) {
  const { t } = useTranslation(["mobile"]);
  const c = useColors();
  const toast = useToast();
  const [text, setText] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<"write" | "preview">("write");
  const [selection, setSelection] = useState({
    start: initial.length,
    end: initial.length,
  });
  const [uploading, setUploading] = useState(false);
  const input = useRef<TextInputInstance>(null);
  const insets = useSafeAreaInsets();
  const [keyboardShown, setKeyboardShown] = useState(false);
  // The keyboard covers the system navigation area, so only clear it while the keyboard is down.
  const bottomInset = keyboardShown ? 0 : insets.bottom;

  useEffect(() => {
    const ios = Platform.OS === "ios";
    const show = Keyboard.addListener(
      ios ? "keyboardWillShow" : "keyboardDidShow",
      () => setKeyboardShown(true),
    );
    const hide = Keyboard.addListener(
      ios ? "keyboardWillHide" : "keyboardDidHide",
      () => setKeyboardShown(false),
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const focus = () => input.current?.focus();

  const wrap = (before: string, after = before, placeholder = "") => {
    const { start, end } = selection;
    const selected = text.slice(start, end) || placeholder;
    setText(text.slice(0, start) + before + selected + after + text.slice(end));
    const cursor = start + before.length + selected.length;
    setSelection({ start: cursor, end: cursor });
    focus();
  };

  const linePrefix = (prefix: string) => {
    const lineStart = text.lastIndexOf("\n", selection.start - 1) + 1;
    setText(text.slice(0, lineStart) + prefix + text.slice(lineStart));
    setSelection({
      start: selection.start + prefix.length,
      end: selection.end + prefix.length,
    });
    focus();
  };

  const insertImage = async () => {
    setUploading(true);
    try {
      const md = await uploadTaskImage(taskId, "description");
      if (md)
        setText(
          (t) =>
            `${t.slice(0, selection.start)}\n${md}\n${t.slice(selection.end)}`,
        );
    } catch (e) {
      toast.show(userMessage(e), "error");
    } finally {
      setUploading(false);
    }
  };

  const ic = { size: 18, color: c.body, strokeWidth: 2 } as const;

  return (
    <Screen surface>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
            height: 52,
            paddingLeft: 6,
            paddingRight: 16,
          }}
        >
          <BackButton close onPress={onClose} />
          <Txt
            variant="body"
            weight="semibold"
            numberOfLines={1}
            style={{ flex: 1, fontSize: 16 }}
          >
            {t("mobile:editor.description")}
          </Txt>
          <Touch
            disabled={saving}
            onPress={async () => {
              setSaving(true);
              const saved = await onSave(text);
              setSaving(false);
              if (saved) onClose();
            }}
            style={{
              height: 32,
              paddingHorizontal: 14,
              borderRadius: 9,
              backgroundColor: c.primary,
              justifyContent: "center",
            }}
          >
            <Txt variant="bodySm" weight="medium" color={c.onPrimary}>
              {t("mobile:common.save")}
            </Txt>
          </Touch>
        </View>
        <View
          style={{
            paddingHorizontal: 16,
            paddingBottom: 10,
            borderBottomWidth: 1,
            borderBottomColor: c.divider,
          }}
        >
          <Segmented
            value={mode}
            onChange={setMode}
            options={[
              { value: "write", label: t("mobile:editor.write") },
              { value: "preview", label: t("mobile:editor.preview") },
            ]}
          />
        </View>
        {mode === "write" ? (
          <TextInput
            ref={input}
            value={text}
            onChangeText={setText}
            selection={selection}
            onSelectionChange={(e) => setSelection(e.nativeEvent.selection)}
            multiline
            autoFocus
            placeholder={t("mobile:editor.placeholder")}
            placeholderTextColor={c.placeholder}
            selectionColor={c.ink}
            textAlignVertical="top"
            style={{
              flex: 1,
              padding: 20,
              fontFamily: font.mono,
              fontSize: 14,
              lineHeight: 22,
              color: c.ink,
            }}
          />
        ) : (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{
              padding: 20,
              paddingBottom: 20 + insets.bottom,
            }}
          >
            {text.trim() ? (
              <MarkdownText>{text}</MarkdownText>
            ) : (
              <Txt tone="placeholder">
                {t("mobile:editor.nothingToPreview")}
              </Txt>
            )}
          </ScrollView>
        )}
        {mode === "write" ? (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              height: 48 + bottomInset,
              paddingHorizontal: 12,
              paddingBottom: bottomInset,
              borderTopWidth: 1,
              borderTopColor: c.hairline,
              backgroundColor: c.ground,
            }}
          >
            <View style={{ flexDirection: "row" }}>
              <Tool
                label={t("mobile:editor.bold")}
                onPress={() =>
                  wrap("**", "**", t("mobile:editor.boldPlaceholder"))
                }
              >
                <Bold {...ic} />
              </Tool>
              <Tool
                label={t("mobile:editor.italic")}
                onPress={() =>
                  wrap("_", "_", t("mobile:editor.italicPlaceholder"))
                }
              >
                <Italic {...ic} />
              </Tool>
              <Tool
                label={t("mobile:editor.heading")}
                onPress={() => linePrefix("## ")}
              >
                <Heading1 {...ic} />
              </Tool>
              <Tool
                label={t("mobile:editor.list")}
                onPress={() => linePrefix("- ")}
              >
                <List {...ic} />
              </Tool>
              <Tool
                label={t("mobile:editor.code")}
                onPress={() =>
                  wrap("`", "`", t("mobile:editor.codePlaceholder"))
                }
              >
                <Code {...ic} />
              </Tool>
              <Tool
                label={t("mobile:editor.link")}
                onPress={() =>
                  wrap("[", "](https://)", t("mobile:editor.linkPlaceholder"))
                }
              >
                <Link2 {...ic} />
              </Tool>
            </View>
            <IconButton
              label={t("mobile:editor.insertImage")}
              onPress={insertImage}
              size={40}
              disabled={uploading}
            >
              {uploading ? (
                <ActivityIndicator size="small" color={c.muted} />
              ) : (
                <ImageIcon {...ic} />
              )}
            </IconButton>
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </Screen>
  );
}
