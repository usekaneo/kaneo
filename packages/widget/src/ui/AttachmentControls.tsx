import { useEffect, useRef, useState, type RefObject } from "react";
import { AttachmentImage } from "./AttachmentImage.js";
import { ImageAnnotation } from "./ImageAnnotation.js";
import { Icon } from "./Icon.js";
import { captureScreenshot } from "./capture.js";
import { MAX_ATTACHMENTS, validateImage } from "./media.js";
import type { WidgetViewProps } from "./types.js";

export function AttachmentControls({
  files,
  onChange,
  disabled,
  camera,
  onCapture,
  onBusy,
  target,
}: {
  files: readonly File[];
  onChange: (files: readonly File[]) => void;
  disabled: boolean;
  camera: boolean;
  onCapture?: WidgetViewProps["onCaptureScreenshot"];
  onBusy: (busy: boolean) => void;
  target: RefObject<HTMLFormElement | null>;
}) {
  const input = useRef<HTMLInputElement>(null);
  const controller = useRef<AbortController | null>(null);
  const busy = useRef(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<{ file: File; index?: number } | null>(
    null,
  );
  useEffect(() => {
    onBusy(false);
    return () => controller.current?.abort();
  }, [onBusy]);
  async function perform(action: (signal: AbortSignal) => Promise<void>) {
    if (disabled || busy.current) return;
    busy.current = true;
    setWorking(true);
    onBusy(true);
    setError("");
    const abort = new AbortController();
    controller.current = abort;
    try {
      await action(abort.signal);
    } catch (error) {
      if (!abort.signal.aborted)
        setError(
          error instanceof Error
            ? error.message
            : "Could not add the image. Please try again.",
        );
    } finally {
      if (!abort.signal.aborted) {
        busy.current = false;
        setWorking(false);
        onBusy(false);
      }
    }
  }
  function add(incoming: readonly File[]) {
    const unique = [...files];
    for (const file of incoming)
      if (
        !unique.some(
          (item) =>
            item.name === file.name &&
            item.size === file.size &&
            item.lastModified === file.lastModified,
        )
      )
        unique.push(file);
    if (unique.length > MAX_ATTACHMENTS)
      throw new Error(`Attach up to ${MAX_ATTACHMENTS} images.`);
    if (unique.length !== files.length) onChange(unique);
  }
  function select(selected: readonly File[]) {
    if (!selected.length) return;
    void perform(async (signal) => {
      if (selected.length > MAX_ATTACHMENTS)
        throw new Error(`Attach up to ${MAX_ATTACHMENTS} images.`);
      await Promise.all(selected.map(validateImage));
      if (!signal.aborted) add(selected);
    });
  }
  useEffect(() => {
    const form = target.current;
    if (!form) return;
    const paste = (event: ClipboardEvent) => {
      const selected = Array.from(event.clipboardData?.files ?? []);
      if (!selected.length || (event.target as Element)?.closest("dialog"))
        return;
      event.preventDefault();
      select(selected);
    };
    const drag = (event: DragEvent) => {
      if (!event.dataTransfer?.types.includes("Files")) return;
      event.preventDefault();
      event.dataTransfer.dropEffect =
        disabled || busy.current ? "none" : "copy";
      form.dataset.drop = "true";
    };
    const leave = () => {
      delete form.dataset.drop;
    };
    const drop = (event: DragEvent) => {
      if (!event.dataTransfer?.types.includes("Files")) return;
      event.preventDefault();
      leave();
      select(Array.from(event.dataTransfer.files));
    };
    form.addEventListener("paste", paste);
    form.addEventListener("dragover", drag);
    form.addEventListener("dragleave", leave);
    form.addEventListener("drop", drop);
    return () => {
      form.removeEventListener("paste", paste);
      form.removeEventListener("dragover", drag);
      form.removeEventListener("dragleave", leave);
      form.removeEventListener("drop", drop);
      leave();
    };
  });
  return (
    <div className="qb-attachment-controls">
      {!!files.length && (
        <div className="qb-draft-images">
          {files.map((file, index) => (
            <div key={`${file.name}:${file.size}:${file.lastModified}`}>
              <button
                type="button"
                disabled={disabled || working}
                onClick={() => setEditing({ file, index })}
                aria-label={`Edit ${file.name}`}
              >
                <AttachmentImage file={file} />
              </button>
              <button
                type="button"
                className="qb-image-remove"
                disabled={disabled || working}
                aria-label={`Remove ${file.name}`}
                onClick={() => onChange(files.filter((_, i) => i !== index))}
              >
                <Icon name="close" />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="qb-attachment-tools">
        <input
          ref={input}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          multiple
          hidden
          aria-label="Choose images"
          onChange={(event) => {
            const selected = Array.from(event.target.files ?? []);
            event.target.value = "";
            select(selected);
          }}
        />
        <button
          type="button"
          className="qb-icon-button"
          aria-label="Attach images"
          title="Attach images"
          disabled={disabled || working || files.length >= MAX_ATTACHMENTS}
          onClick={() => input.current?.click()}
        >
          <Icon name={camera ? "image" : "attachment"} />
        </button>
        {camera && (
          <button
            type="button"
            className="qb-icon-button"
            aria-label="Capture screenshot"
            title="Capture screenshot"
            disabled={disabled || working || files.length >= MAX_ATTACHMENTS}
            onClick={() =>
              void perform(async (signal) => {
                const file = await (onCapture ?? captureScreenshot)(signal);
                if (file && !signal.aborted) {
                  await validateImage(file);
                  if (!signal.aborted) setEditing({ file });
                }
              })
            }
          >
            <Icon name="camera" />
          </button>
        )}
        {working && <span role="status">Preparing image…</span>}
      </div>
      {error && (
        <p role="alert" className="qb-form-error">
          {error}
        </p>
      )}
      {editing && (
        <ImageAnnotation
          file={editing.file}
          onCancel={() => setEditing(null)}
          onSave={(file) => {
            const index = editing.index;
            if (index === undefined) add([file]);
            else onChange(files.map((item, i) => (i === index ? file : item)));
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}
