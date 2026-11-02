import { useState } from "react";

import { useToast } from "@/components/toast";
import { userMessage } from "@/lib/api/client";
import { uploadTaskImageAsset } from "@/lib/upload";

import { useFormatState } from "./format-store";
import { FormattingToolbar } from "./formatting-toolbar";
import { LinkSheet } from "./link-sheet";
import type { RichDescription } from "./use-rich-description";

export function DescriptionToolbar({
  taskId,
  editor,
}: {
  taskId: string;
  editor: RichDescription;
}) {
  const toast = useToast();
  const format = useFormatState(editor.formats);
  const [uploading, setUploading] = useState(false);
  const [linking, setLinking] = useState(false);

  const insertImage = async () => {
    setUploading(true);
    try {
      const image = await uploadTaskImageAsset(taskId, "description");
      if (image) editor.run({ type: "image", src: image.url, alt: image.alt });
    } catch (e) {
      toast.show(userMessage(e), "error");
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <FormattingToolbar
        state={format}
        bottomInset={0}
        uploading={uploading}
        onCommand={editor.run}
        onLink={() => setLinking(true)}
        onImage={insertImage}
        onDone={editor.blur}
      />
      <LinkSheet
        visible={linking}
        current={format.link}
        onClose={() => setLinking(false)}
        onApply={(href) => editor.run({ type: "link", href })}
      />
    </>
  );
}
