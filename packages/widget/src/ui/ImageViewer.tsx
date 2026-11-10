import { useEffect, useId, useRef, useState } from "react";
import { Icon } from "./Icon.js";
import type { Attachment } from "./types.js";

/** Receives only URLs already checked by AttachmentGallery; the host owns them. */
export function ImageViewer({
  attachments,
  initialId,
  onClose,
}: {
  attachments: readonly Attachment[];
  initialId: string;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const returnFocus = useRef(document.activeElement);
  const title = useId();
  const [selected, setSelected] = useState(initialId);
  const [zoomed, setZoomed] = useState(false);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const index = attachments.findIndex((item) => item.id === selected);
  const item = attachments[index];
  const failed = item?.url === failedUrl;
  useEffect(() => {
    const previous = returnFocus.current;
    dialog.current?.showModal();
    return () => {
      if (previous instanceof HTMLElement && previous.isConnected)
        previous.focus({ preventScroll: true });
    };
  }, []);
  useEffect(() => {
    if (!item) onClose();
  }, [item, onClose]);
  const move = (next: number) => {
    const target = attachments[next];
    if (!target) return;
    setSelected(target.id);
    setZoomed(false);
    setFailedUrl(null);
  };
  return (
    <dialog
      ref={dialog}
      className="qb-image-viewer"
      aria-labelledby={title}
      onClose={onClose}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (
          zoomed &&
          event.target instanceof HTMLElement &&
          event.target.classList.contains("qb-image-viewport")
        )
          return;
        if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
          event.preventDefault();
          move(index + (event.key === "ArrowLeft" ? -1 : 1));
        }
      }}
    >
      <header>
        <strong id={title}>{item?.name ?? "Image"}</strong>
        <button
          type="button"
          className="qb-icon-button"
          aria-label="Close image viewer"
          autoFocus
          onClick={onClose}
        >
          <Icon name="close" />
        </button>
      </header>
      {/* oxlint-disable jsx-a11y/no-noninteractive-tabindex -- The zoomed image region must accept focus for native keyboard scrolling. */}
      <div
        className="qb-image-viewport"
        role="region"
        tabIndex={0}
        aria-label="Image preview"
        data-zoomed={zoomed}
      >
        {item && !failed ? (
          <img
            key={item.url}
            src={item.url}
            alt={item.name}
            referrerPolicy="no-referrer"
            onError={() => setFailedUrl(item.url)}
          />
        ) : (
          <p role="alert">This image could not be loaded.</p>
        )}
      </div>
      {/* oxlint-enable jsx-a11y/no-noninteractive-tabindex */}
      <footer>
        <button
          type="button"
          className="qb-icon-button"
          aria-label="Previous image"
          disabled={index <= 0}
          onClick={() => move(index - 1)}
        >
          <Icon name="back" />
        </button>
        <span aria-live="polite">
          {index + 1} of {attachments.length}
        </span>
        <button
          type="button"
          className="qb-icon-button"
          aria-label="Next image"
          disabled={index >= attachments.length - 1}
          onClick={() => move(index + 1)}
        >
          <Icon name="chevron" />
        </button>
        <button
          type="button"
          className="qb-text-button"
          aria-pressed={zoomed}
          disabled={failed}
          onClick={() => setZoomed((value) => !value)}
        >
          <Icon name="search" />
          {zoomed ? "Fit image" : "Zoom in"}
        </button>
      </footer>
    </dialog>
  );
}
