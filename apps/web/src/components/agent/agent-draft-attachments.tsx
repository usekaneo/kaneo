import { useState } from "react";
import type { AgentAttachmentDraft } from "./agent-attachment-draft";
import { AgentAttachmentChip } from "./agent-attachment-chip";
import { AgentDraftImage } from "./agent-draft-image";
import {
  AgentImagePreview,
  type AgentPreviewImage,
} from "./agent-image-preview";

type AgentDraftAttachmentsProps = {
  items: AgentAttachmentDraft[];
  onRemove: (key: string) => void;
};

export function AgentDraftAttachments({
  items,
  onRemove,
}: AgentDraftAttachmentsProps) {
  const [preview, setPreview] = useState<AgentPreviewImage | null>(null);
  if (items.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {items.map((item) =>
        item.kind === "file" && item.mediaType.startsWith("image/") ? (
          <AgentDraftImage
            key={item.key}
            draft={item}
            onPreview={(src) => setPreview({ src, name: item.name })}
            onRemove={() => onRemove(item.key)}
          />
        ) : (
          <AgentAttachmentChip
            key={item.key}
            name={item.name}
            pdf={item.kind === "file"}
            uploading={item.kind === "file" && !item.id}
            onRemove={() => onRemove(item.key)}
          />
        ),
      )}
      <AgentImagePreview image={preview} onClose={() => setPreview(null)} />
    </div>
  );
}
