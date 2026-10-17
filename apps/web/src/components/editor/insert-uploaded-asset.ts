import type { Editor } from "@tiptap/core";
import type { uploadTaskImage } from "@/lib/upload-task-image";

export function insertUploadedAsset(
  editor: Editor,
  asset: Awaited<ReturnType<typeof uploadTaskImage>>,
  errorMessage: string,
  range?: { from: number; to: number },
) {
  const chain = editor.chain().focus();
  if (range) chain.deleteRange(range);
  else if (!editor.state.selection.empty)
    chain.setTextSelection(editor.state.selection.to);
  const ran =
    asset.kind === "image"
      ? chain.setImage({ src: asset.url, alt: asset.alt }).run()
      : chain
          .insertContent({
            type: "attachmentCard",
            attrs: {
              url: asset.url,
              filename: asset.filename,
              mimeType: asset.mimeType,
              size: asset.size,
            },
          })
          .run();
  if (!ran) throw new Error(errorMessage);
}
