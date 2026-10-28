import * as WebBrowser from "expo-web-browser";
import { Image } from "expo-image";
import Markdown from "react-native-markdown-display";

import { toDisplayMarkdown } from "@/lib/markdown";
import { useSession } from "@/lib/session";
import { font, useColors } from "@/theme";

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
  const lineHeight = Math.round(size * 1.5);
  const ink = color ?? c.body;
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
              borderRadius: 8,
              marginVertical: 6,
              backgroundColor: c.fill,
            }}
            contentFit="contain"
            accessibilityLabel={String(node.attributes.alt ?? "")}
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
        paragraph: { marginTop: 0, marginBottom: 8 },
        strong: {
          fontFamily: font.semibold,
          fontWeight: "normal",
          color: c.ink,
        },
        em: { fontStyle: "italic" },
        heading1: {
          fontFamily: font.semibold,
          fontSize: size + 5,
          lineHeight: lineHeight + 6,
          color: c.ink,
          marginTop: 6,
          marginBottom: 6,
        },
        heading2: {
          fontFamily: font.semibold,
          fontSize: size + 3,
          lineHeight: lineHeight + 4,
          color: c.ink,
          marginTop: 6,
          marginBottom: 6,
        },
        heading3: {
          fontFamily: font.semibold,
          fontSize: size + 1,
          lineHeight: lineHeight + 2,
          color: c.ink,
          marginTop: 4,
          marginBottom: 4,
        },
        link: { color: c.link, textDecorationLine: "none" },
        code_inline: {
          fontFamily: font.mono,
          fontSize: size - 2,
          backgroundColor: c.fill,
          color: c.ink,
          borderRadius: 4,
          paddingHorizontal: 4,
        },
        code_block: {
          fontFamily: font.mono,
          fontSize: size - 2,
          backgroundColor: c.fill,
          color: c.ink,
          borderRadius: 8,
          padding: 12,
          borderWidth: 0,
        },
        fence: {
          fontFamily: font.mono,
          fontSize: size - 2,
          backgroundColor: c.fill,
          color: c.ink,
          borderRadius: 8,
          padding: 12,
          borderWidth: 0,
        },
        blockquote: {
          backgroundColor: "transparent",
          borderLeftWidth: 3,
          borderLeftColor: c.fillStrong,
          paddingLeft: 12,
          marginLeft: 0,
        },
        bullet_list: { marginBottom: 8 },
        ordered_list: { marginBottom: 8 },
        list_item: { marginBottom: 2 },
        hr: { backgroundColor: c.divider, height: 1, marginVertical: 12 },
        table: { borderColor: c.hairline },
        tr: { borderColor: c.hairline },
      }}
    >
      {text}
    </Markdown>
  );
}
