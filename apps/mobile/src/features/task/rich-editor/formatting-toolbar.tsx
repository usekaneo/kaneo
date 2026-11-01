import {
  Bold,
  Code,
  Heading2,
  Image as ImageIcon,
  Italic,
  KeyboardOff,
  Link2,
  List,
  ListChecks,
  ListOrdered,
  Quote,
  type LucideIcon,
} from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, ScrollView, View } from "react-native";

import { IconButton } from "@/components/ui";
import { radius, useColors } from "@/theme";

import type { EditorCommand, EditorFormatState } from "./editor-commands";

type ToggleType = Exclude<
  EditorCommand["type"],
  "link" | "image" | "undo" | "redo"
> &
  keyof EditorFormatState;

const TOGGLES: { type: ToggleType; icon: LucideIcon; label: string }[] = [
  { type: "bold", icon: Bold, label: "mobile:editor.bold" },
  { type: "italic", icon: Italic, label: "mobile:editor.italic" },
  { type: "heading", icon: Heading2, label: "mobile:editor.heading" },
  { type: "taskList", icon: ListChecks, label: "mobile:editor.checklist" },
  { type: "bulletList", icon: List, label: "mobile:editor.list" },
  {
    type: "orderedList",
    icon: ListOrdered,
    label: "mobile:editor.numberedList",
  },
  { type: "blockquote", icon: Quote, label: "mobile:editor.quote" },
  { type: "code", icon: Code, label: "mobile:editor.code" },
];

export function FormattingToolbar({
  state,
  bottomInset,
  uploading,
  onCommand,
  onLink,
  onImage,
  onDone,
}: {
  state: EditorFormatState;
  bottomInset: number;
  uploading: boolean;
  onCommand: (command: EditorCommand) => void;
  onLink: () => void;
  onImage: () => void;
  onDone: () => void;
}) {
  const { t } = useTranslation(["mobile"]);
  const c = useColors();
  const icon = (Icon: LucideIcon, active: boolean) => (
    <Icon size={18} color={active ? c.ink : c.body} strokeWidth={2} />
  );
  const activeStyle = (active: boolean) =>
    active ? { backgroundColor: c.fill, borderRadius: radius.md } : undefined;

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        height: 48 + bottomInset,
        paddingBottom: bottomInset,
        borderTopWidth: 1,
        borderTopColor: c.hairline,
        backgroundColor: c.ground,
      }}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="always"
        contentContainerStyle={{ paddingHorizontal: 8, alignItems: "center" }}
      >
        {TOGGLES.map(({ type, icon: Icon, label }) => (
          <View key={type} style={activeStyle(state[type])}>
            <IconButton
              label={t(label as "mobile:editor.bold")}
              onPress={() => onCommand({ type })}
              size={40}
            >
              {icon(Icon, state[type])}
            </IconButton>
          </View>
        ))}
        <View style={activeStyle(!!state.link)}>
          <IconButton
            label={t("mobile:editor.link")}
            onPress={onLink}
            size={40}
          >
            {icon(Link2, !!state.link)}
          </IconButton>
        </View>
        <IconButton
          label={t("mobile:editor.insertImage")}
          onPress={onImage}
          size={40}
          disabled={uploading}
        >
          {uploading ? (
            <ActivityIndicator size="small" color={c.muted} />
          ) : (
            icon(ImageIcon, false)
          )}
        </IconButton>
      </ScrollView>
      <View
        style={{
          paddingHorizontal: 8,
          borderLeftWidth: 1,
          borderLeftColor: c.hairline,
        }}
      >
        <IconButton
          label={t("mobile:editor.hideKeyboard")}
          onPress={onDone}
          size={40}
        >
          {icon(KeyboardOff, false)}
        </IconButton>
      </View>
    </View>
  );
}
