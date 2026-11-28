import { EmbedBlock as EmbedBlockNode } from "@kaneo/editor";
import { i18n } from "@/lib/i18n";

export const EmbedBlock = EmbedBlockNode.configure({
  embeddedContentTitle: () =>
    i18n.t("tasks:detail.editor.embed.embeddedContent"),
  onlyYoutubeInlineLabel: () =>
    i18n.t("tasks:detail.editor.embed.onlyYoutubeInline"),
});
