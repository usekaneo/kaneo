import { safeMediaUrl } from "./media.js";
import { useState } from "react";
import { ImageViewer } from "./ImageViewer.js";
import type { Attachment } from "./types.js";

export function AttachmentGallery({
  attachments = [],
}: {
  attachments?: readonly Attachment[];
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const images = attachments.filter((item) => safeMediaUrl(item.url, true));
  if (!images.length) return null;
  return (
    <div className="qb-attachment-gallery">
      {images.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => setSelected(item.id)}
          aria-label={`Open attachment ${item.name}`}
        >
          <img
            src={item.url}
            alt={item.name}
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        </button>
      ))}
      {selected && (
        <ImageViewer
          attachments={images}
          initialId={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
