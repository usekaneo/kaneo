import { useState } from "react";
import type { AgentRunAttachment } from "@/types/agent";
import { AgentAttachmentChip } from "./agent-attachment-chip";
import { getAgentAttachmentUrl } from "./agent-attachment-url";
import {
  AgentImagePreview,
  type AgentPreviewImage,
} from "./agent-image-preview";
import { AgentImageThumbnail } from "./agent-image-thumbnail";

type AgentRunAttachmentsProps = {
  workspaceId: string;
  attachments: AgentRunAttachment[];
};

export function AgentRunAttachments({
  workspaceId,
  attachments,
}: AgentRunAttachmentsProps) {
  const [preview, setPreview] = useState<AgentPreviewImage | null>(null);
  if (attachments.length === 0) return null;

  return (
    <div className="flex max-w-[85%] flex-wrap justify-end gap-1.5">
      {attachments.map((file) => {
        if (file.type === "text")
          return (
            <AgentAttachmentChip key={`text-${file.name}`} name={file.name} />
          );
        const src = getAgentAttachmentUrl(workspaceId, file.id);
        return file.mediaType.startsWith("image/") ? (
          <AgentImageThumbnail
            key={file.id}
            name={file.name}
            src={src}
            size="md"
            onPreview={() => setPreview({ src, name: file.name })}
          />
        ) : (
          <AgentAttachmentChip key={file.id} name={file.name} pdf href={src} />
        );
      })}
      <AgentImagePreview image={preview} onClose={() => setPreview(null)} />
    </div>
  );
}
