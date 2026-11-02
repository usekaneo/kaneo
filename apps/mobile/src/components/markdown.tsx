import * as WebBrowser from "expo-web-browser";
import { Image } from "expo-image";
import { Text, View } from "react-native";
import Markdown, {
  hasParents,
  renderRules,
} from "react-native-markdown-display";

import { toDisplayMarkdown } from "@/lib/markdown";
import { useSession } from "@/lib/session";
import { stripTaskMarker, taskItemState } from "@/lib/task-item";
import { font, radius, useColors } from "@/theme";

import { MarkdownTaskItem } from "./markdown-task-item";
import { MarkdownTextRun } from "./markdown-text-run";

/** Renders Kaneo Markdown (with its custom tags rewritten) in the app's type styles. */
export function MarkdownText({
  children,
  size = 15,
  color,
}: {
  children: string;
  size?: number;
  color?: string;
}) {
  const c = useColors();
  const session = useSession();
  const text = toDisplayMarkdown(children, session?.serverUrl ?? "");
  const lineHeight = Math.round(size * 1.6);
  const ink = color ?? c.body;
  const heading = (scale: number) => ({
    fontFamily: font.semibold,
    fontSize: Math.round(size * scale),
    lineHeight: Math.round(size * scale * 1.26),
    letterSpacing: -0.02 * size * scale,
    color: c.ink,
    marginTop: 12,
    marginBottom: 6,
  });
  const codeBox = {
    fontFamily: font.mono,
    fontSize: size - 2,
    lineHeight: Math.round((size - 2) * 1.5),
    backgroundColor: c.fill,
    color: c.ink,
    borderWidth: 1,
    borderColor: c.hairline,
    borderRadius: radius.md,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginVertical: 6,
  };
  return (
    <Markdown
      onLinkPress={(url) => {
        void WebBrowser.openBrowserAsync(url);
        return false;
      }}
      rules={{
        image: (node) => (
          <Image
            key={node.key}
            source={{ uri: String(node.attributes.src) }}
            style={{
              width: "100%",
              aspectRatio: 16 / 10,
              borderRadius: radius.md,
              marginVertical: 6,
              backgroundColor: c.fill,
            }}
            contentFit="contain"
            accessibilityLabel={String(node.attributes.alt ?? "")}
          />
        ),
        list_item: (node, children, parent, styles, inheritedStyles) => {
          const state = taskItemState(node);
          if (!state && hasParents(parent, "bullet_list"))
            return (
              <View key={node.key} style={{ flexDirection: "row" }}>
                <Text
                  style={{
                    width: 18,
                    color: c.muted,
                    fontSize: size,
                    lineHeight,
                  }}
                  accessible={false}
                >
                  •
                </Text>
                <View style={{ flex: 1, minWidth: 0 }}>{children}</View>
              </View>
            );
          if (!state)
            return renderRules.list_item?.(
              node,
              children,
              parent,
              styles,
              inheritedStyles,
            );
          return (
            <MarkdownTaskItem key={node.key} checked={state === "checked"}>
              {children}
            </MarkdownTaskItem>
          );
        },
        text: (node, _children, parent, styles, inheritedStyles = {}) => (
          <MarkdownTextRun
            key={node.key}
            content={
              parent.some((p) => p.type === "list_item")
                ? stripTaskMarker(node.content)
                : node.content
            }
            style={[inheritedStyles, styles.text]}
          />
        ),
      }}
      style={{
        body: {
          color: ink,
          fontFamily: font.regular,
          fontSize: size,
          lineHeight,
        },
        paragraph: { marginTop: 0, marginBottom: 6 },
        strong: {
          fontFamily: font.semibold,
          fontWeight: "normal",
          color: c.ink,
        },
        em: { fontStyle: "italic" },
        s: { textDecorationLine: "line-through", color: c.muted },
        heading1: heading(1.29),
        heading2: heading(1.16),
        heading3: heading(1.06),
        link: {
          color: c.link,
          textDecorationLine: "underline",
          textDecorationColor: `${c.link}73`,
        },
        code_inline: {
          fontFamily: font.mono,
          fontSize: size - 2,
          backgroundColor: c.fill,
          color: c.ink,
          borderWidth: 1,
          borderColor: c.hairline,
          borderRadius: radius.sm,
          paddingHorizontal: 4,
        },
        code_block: codeBox,
        fence: codeBox,
        blockquote: {
          backgroundColor: "transparent",
          borderLeftWidth: 2,
          borderLeftColor: c.fillStrong,
          paddingLeft: 12,
          marginLeft: 0,
          marginVertical: 6,
          color: c.ink2,
        },
        bullet_list: { marginVertical: 4 },
        ordered_list: { marginVertical: 4 },
        list_item: { marginVertical: 2 },
        bullet_list_icon: { color: c.muted, marginLeft: 4, marginRight: 8 },
        ordered_list_icon: { color: c.muted, marginLeft: 2, marginRight: 8 },
        hr: { backgroundColor: c.divider, height: 1, marginVertical: 12 },
        table: {
          borderWidth: 1,
          borderColor: c.hairline,
          borderRadius: radius.md,
          marginVertical: 8,
          overflow: "hidden",
        },
        thead: { backgroundColor: c.fill },
        th: { padding: 8, fontFamily: font.semibold, color: c.ink },
        tr: { borderBottomWidth: 1, borderColor: c.hairline },
        td: { padding: 8 },
      }}
    >
      {text}
    </Markdown>
  );
}
