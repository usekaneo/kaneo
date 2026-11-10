import { useEffect, useId, useRef, useState, type PointerEvent } from "react";
import { validateImage } from "./media.js";
import { Icon } from "./Icon.js";

type Mark = {
  x: number;
  y: number;
  width: number;
  height: number;
  redact: boolean;
};

export function ImageAnnotation({
  file,
  onSave,
  onCancel,
}: {
  file: File;
  onSave: (file: File) => void | Promise<void>;
  onCancel: () => void;
}) {
  const titleId = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const source = useRef<HTMLImageElement | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const [marks, setMarks] = useState<Mark[]>([]);
  const [redact, setRedact] = useState(false);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const active = useRef(false);
  useEffect(() => {
    active.current = true;
    const previous = document.activeElement;
    const modal = dialog.current;
    modal?.showModal();
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      if (!active.current || !canvas.current) return;
      const scale = Math.min(
        1,
        2048 / Math.max(image.naturalWidth, image.naturalHeight),
      );
      canvas.current.width = Math.max(
        1,
        Math.round(image.naturalWidth * scale),
      );
      canvas.current.height = Math.max(
        1,
        Math.round(image.naturalHeight * scale),
      );
      source.current = image;
      setReady(true);
    };
    image.onerror = () => {
      if (active.current)
        setError("This image could not be opened. Choose another image.");
    };
    image.src = url;
    return () => {
      active.current = false;
      image.onload = null;
      image.onerror = null;
      URL.revokeObjectURL(url);
      modal?.close();
      if (previous instanceof HTMLElement && previous.isConnected)
        previous.focus();
    };
  }, [file]);
  useEffect(() => {
    const target = canvas.current;
    const image = source.current;
    const context = target?.getContext("2d");
    if (!target || !image || !context || !ready) return;
    context.clearRect(0, 0, target.width, target.height);
    context.drawImage(image, 0, 0, target.width, target.height);
    for (const mark of marks) {
      const x = (mark.x * target.width) / 100,
        y = (mark.y * target.height) / 100,
        width = (mark.width * target.width) / 100,
        height = (mark.height * target.height) / 100;
      if (mark.redact) {
        context.fillStyle = "#171717";
        context.fillRect(x, y, width, height);
      } else {
        context.strokeStyle = "#e53935";
        context.lineWidth = Math.max(3, target.width / 300);
        context.strokeRect(x, y, width, height);
      }
    }
  }, [marks, ready]);
  const point = (event: PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.max(
        0,
        Math.min(100, ((event.clientX - rect.left) / rect.width) * 100),
      ),
      y: Math.max(
        0,
        Math.min(100, ((event.clientY - rect.top) / rect.height) * 100),
      ),
    };
  };
  async function save() {
    if (!canvas.current || saving) return;
    setSaving(true);
    setError("");
    try {
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.current!.toBlob(resolve, "image/png"),
      );
      if (!active.current) return;
      if (!blob) throw new Error("Could not save the image. Please try again.");
      const output = new File(
        [blob],
        file.name.replace(/\.[^.]+$/, "") + ".png",
        { type: "image/png" },
      );
      await validateImage(output);
      if (active.current) await onSave(output);
    } catch (error) {
      if (active.current)
        setError(
          error instanceof Error
            ? error.message
            : "Could not save the image. Please try again.",
        );
    } finally {
      if (active.current) setSaving(false);
    }
  }
  const selected = marks[marks.length - 1];
  return (
    <dialog
      className="qb-annotation"
      ref={dialog}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") event.stopPropagation();
      }}
    >
      <header>
        <h2 id={titleId}>Review image</h2>
        <button
          type="button"
          className="qb-icon-button"
          aria-label="Cancel image editing"
          onClick={onCancel}
        >
          <Icon name="close" />
        </button>
      </header>
      <p>Draw a highlight or hide sensitive information before attaching.</p>
      <div className="qb-annotation-tools">
        <button
          type="button"
          aria-pressed={!redact}
          onClick={() => setRedact(false)}
        >
          Highlight
        </button>
        <button
          type="button"
          aria-pressed={redact}
          onClick={() => setRedact(true)}
        >
          Redact
        </button>
        <button
          type="button"
          disabled={!ready || saving}
          onClick={() =>
            setMarks([
              ...marks,
              { x: 20, y: 20, width: 30, height: 20, redact },
            ])
          }
        >
          Add rectangle
        </button>
        <button
          type="button"
          disabled={!marks.length || saving}
          onClick={() => setMarks(marks.slice(0, -1))}
        >
          <Icon name="undo" />
          Undo
        </button>
      </div>
      <canvas
        ref={canvas}
        aria-label="Image preview. Draw with a pointer or use Add rectangle and position fields."
        onPointerDown={(event) => {
          if (!ready || saving) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          start.current = point(event);
          setMarks([
            ...marks,
            { ...start.current, width: 0, height: 0, redact },
          ]);
        }}
        onPointerMove={(event) => {
          if (!start.current) return;
          const p = point(event),
            s = start.current;
          setMarks((current) => [
            ...current.slice(0, -1),
            {
              x: Math.min(p.x, s.x),
              y: Math.min(p.y, s.y),
              width: Math.abs(p.x - s.x),
              height: Math.abs(p.y - s.y),
              redact,
            },
          ]);
        }}
        onPointerUp={() => {
          start.current = null;
        }}
        onPointerCancel={() => {
          start.current = null;
        }}
      />
      {selected && (
        <fieldset disabled={saving}>
          <legend>Rectangle position (%)</legend>
          {(["x", "y", "width", "height"] as const).map((key) => (
            <label key={key}>
              {key}
              <input
                aria-label={`Rectangle ${key}`}
                type="number"
                min="0"
                max="100"
                value={Math.round(selected[key])}
                onChange={(event) => {
                  const value = event.target.valueAsNumber;
                  if (Number.isFinite(value))
                    setMarks((current) =>
                      current.map((mark, i) =>
                        i === current.length - 1
                          ? {
                              ...mark,
                              [key]: Math.min(100, Math.max(0, value)),
                            }
                          : mark,
                      ),
                    );
                }}
              />
            </label>
          ))}
        </fieldset>
      )}
      {error && <p role="alert">{error}</p>}
      <footer>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
        <button
          type="button"
          className="qb-primary"
          disabled={!ready || saving}
          onClick={() => void save()}
        >
          {saving ? "Saving…" : "Use image"}
        </button>
      </footer>
    </dialog>
  );
}
