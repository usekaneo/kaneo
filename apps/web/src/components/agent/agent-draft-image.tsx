import type { AgentFileDraft } from "./agent-attachment-draft";
import { AgentImageThumbnail } from "./agent-image-thumbnail";
import { useObjectUrl } from "./use-object-url";

type AgentDraftImageProps = {
  draft: AgentFileDraft;
  onPreview: (src: string) => void;
  onRemove: () => void;
};

export function AgentDraftImage({
  draft,
  onPreview,
  onRemove,
}: AgentDraftImageProps) {
  const src = useObjectUrl(draft.file);

  return (
    <AgentImageThumbnail
      name={draft.name}
      src={src}
      uploading={!draft.id}
      onPreview={() => src && onPreview(src)}
      onRemove={onRemove}
    />
  );
}
