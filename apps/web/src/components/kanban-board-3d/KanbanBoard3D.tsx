import { useNavigate } from "@tanstack/react-router";
import { RotateCcw } from "lucide-react";
import { type ReactElement, useCallback, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { getPriorityIcon } from "@/lib/priority";
import type { ProjectWithTasks } from "@/types/project";
import type Task from "@/types/task";

type KanbanBoard3DProps = {
  project: ProjectWithTasks;
};

type Camera = {
  x: number;
  y: number;
  z: number;
  rx: number;
  ry: number;
};

const PERSPECTIVE = 1200;
const COLUMN_WIDTH = 300;
const COLUMN_GAP = 60;

function defaultCamera(): Camera {
  return {
    x: 0,
    y: 0,
    z: window.innerWidth < 768 ? -2200 : -1200,
    rx: 12,
    ry: -18,
  };
}

function KanbanBoard3D({ project }: KanbanBoard3DProps): ReactElement {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const viewportRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const cameraRef = useRef<Camera>(defaultCamera());
  const dragRef = useRef<{
    mode: "pan" | "rotate" | null;
    lastX: number;
    lastY: number;
  }>({ mode: null, lastX: 0, lastY: 0 });

  const applyCamera = useCallback(() => {
    const camera = cameraRef.current;
    if (!worldRef.current) return;
    worldRef.current.style.transform = `translate3d(${-camera.x}px, ${-camera.y}px, ${camera.z}px) rotateX(${camera.rx}deg) rotateY(${camera.ry}deg)`;
  }, []);

  const resetCamera = useCallback(() => {
    cameraRef.current = defaultCamera();
    applyCamera();
  }, [applyCamera]);

  useEffect(() => {
    applyCamera();
  }, [applyCamera]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const onPointerDown = (event: PointerEvent) => {
      if ((event.target as HTMLElement).closest("button")) return;
      dragRef.current = {
        mode:
          event.button === 2 || event.ctrlKey || event.shiftKey
            ? "rotate"
            : "pan",
        lastX: event.clientX,
        lastY: event.clientY,
      };
      viewport.setPointerCapture?.(event.pointerId);
      viewport.style.cursor = "grabbing";
    };

    const onPointerMove = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag.mode) return;
      const camera = cameraRef.current;
      const dx = event.clientX - drag.lastX;
      const dy = event.clientY - drag.lastY;
      if (drag.mode === "pan") {
        const sensitivity = camera.z / -PERSPECTIVE;
        camera.x -= dx * sensitivity;
        camera.y -= dy * sensitivity;
      } else {
        camera.ry += dx * 0.3;
        camera.rx -= dy * 0.3;
        camera.rx = Math.min(80, Math.max(-80, camera.rx));
      }
      drag.lastX = event.clientX;
      drag.lastY = event.clientY;
      applyCamera();
    };

    const endDrag = () => {
      dragRef.current.mode = null;
      viewport.style.cursor = "grab";
    };

    const onWheel = (event: WheelEvent) => {
      // wheel over an overflowing task list scrolls the list; the camera
      // only zooms once the list cannot scroll further in that direction
      const scroller = (event.target as Element | null)?.closest?.(
        "[data-board3d-scroll]",
      );
      if (
        scroller instanceof HTMLElement &&
        scroller.scrollHeight > scroller.clientHeight
      ) {
        const atTop = scroller.scrollTop <= 0;
        const atBottom =
          scroller.scrollTop + scroller.clientHeight >=
          scroller.scrollHeight - 1;
        if (event.deltaY < 0 ? !atTop : !atBottom) return;
      }
      event.preventDefault();
      const camera = cameraRef.current;
      camera.z += event.deltaY * 2;
      camera.z = Math.min(-200, Math.max(-10000, camera.z));
      applyCamera();
    };

    const onContextMenu = (event: Event) => event.preventDefault();

    viewport.addEventListener("pointerdown", onPointerDown);
    viewport.addEventListener("pointermove", onPointerMove);
    viewport.addEventListener("pointerup", endDrag);
    viewport.addEventListener("pointercancel", endDrag);
    viewport.addEventListener("wheel", onWheel, { passive: false });
    viewport.addEventListener("contextmenu", onContextMenu);
    return () => {
      viewport.removeEventListener("pointerdown", onPointerDown);
      viewport.removeEventListener("pointermove", onPointerMove);
      viewport.removeEventListener("pointerup", endDrag);
      viewport.removeEventListener("pointercancel", endDrag);
      viewport.removeEventListener("wheel", onWheel);
      viewport.removeEventListener("contextmenu", onContextMenu);
    };
  }, [applyCamera]);

  const openTask = useCallback(
    (task: Task) => {
      navigate({
        to: ".",
        search: { taskId: task.id },
        replace: true,
      });
    },
    [navigate],
  );

  const columns = project.columns;
  const totalWidth =
    columns.length * COLUMN_WIDTH + (columns.length - 1) * COLUMN_GAP;

  return (
    <div
      ref={viewportRef}
      data-board3d-viewport
      className="relative h-full w-full overflow-hidden bg-background cursor-grab select-none"
      style={{ perspective: `${PERSPECTIVE}px` }}
    >
      <div
        ref={worldRef}
        data-board3d-world
        className="pointer-events-none absolute h-full w-full transition-transform duration-100 ease-out"
        style={{ transformStyle: "preserve-3d" }}
      >
        <div
          className="absolute top-1/2 left-1/2"
          style={{ transformStyle: "preserve-3d" }}
        >
          {columns.map((column, index) => {
            const x = index * (COLUMN_WIDTH + COLUMN_GAP) - totalWidth / 2;
            // slight arc: outer columns recede and turn toward the camera
            const center = (columns.length - 1) / 2;
            const offset = index - center;
            const z = -Math.abs(offset) * 40;
            const ry = -offset * 6;
            return (
              <div
                key={column.id}
                className="pointer-events-auto absolute flex max-h-[560px] w-[300px] flex-col rounded-xl border border-border/70 bg-muted/40 shadow-lg backdrop-blur-sm dark:bg-card/90"
                style={{
                  transform: `translate3d(${x}px, -150px, ${z}px) rotateY(${ry}deg)`,
                  transformStyle: "preserve-3d",
                }}
              >
                <div className="shrink-0 border-b border-border/60 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">
                      {column.name}
                    </span>
                    <span className="rounded bg-accent px-1.5 text-xs text-muted-foreground">
                      {column.tasks.length}
                    </span>
                  </div>
                </div>
                <div
                  data-board3d-scroll
                  className="min-h-0 flex-1 touch-pan-y space-y-2 overflow-y-auto px-2 py-2"
                >
                  {column.tasks.map((task) => (
                    <button
                      key={task.id}
                      type="button"
                      data-task-card
                      onClick={() => openTask(task)}
                      className="w-full rounded-lg border border-border bg-card p-3 text-left shadow-sm transition-colors hover:border-ring/40 hover:bg-accent/40"
                    >
                      <div className="flex items-start gap-2">
                        <span className="mt-0.5 shrink-0">
                          {getPriorityIcon(task.priority ?? "")}
                        </span>
                        <div className="min-w-0">
                          <div className="truncate text-xs text-muted-foreground">
                            {task.number != null && `#${task.number}`}
                          </div>
                          <div className="line-clamp-3 text-sm text-foreground">
                            {task.title}
                          </div>
                          {task.assigneeName && (
                            <div className="mt-1 truncate text-xs text-muted-foreground">
                              {task.assigneeName}
                            </div>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                  {column.tasks.length === 0 && (
                    <div className="px-2 py-4 text-center text-xs text-muted-foreground">
                      —
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="absolute right-3 bottom-3 flex items-center gap-2">
        <button
          type="button"
          onClick={resetCamera}
          className="inline-flex h-7 items-center gap-1 rounded-md border border-border bg-card px-2 text-xs font-medium text-muted-foreground shadow-sm transition-colors hover:bg-accent/60 hover:text-foreground"
        >
          <RotateCcw className="h-3 w-3" />
          {t("tasks:board3d.reset")}
        </button>
      </div>
      <div className="pointer-events-none absolute bottom-3 left-3 rounded-md border border-border/60 bg-card/80 px-2 py-1 text-[11px] text-muted-foreground backdrop-blur-sm">
        {t("tasks:board3d.hint")}
      </div>
    </div>
  );
}

export default KanbanBoard3D;
