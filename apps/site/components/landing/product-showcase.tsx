"use client";

import {
  CalendarDays,
  CalendarRange,
  ListTodo,
  Pause,
  Play,
  SquareKanban,
} from "lucide-react";
import Image from "next/image";
import {
  type CSSProperties,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  AppPreview,
  type AppPreviewHandle,
  type PreviewMode,
} from "@/components/landing/app-preview";
import { landing } from "@/lib/landing";
import messages from "../../../../i18n/en-US.json";
import styles from "./product-showcase.module.css";

const scenes = [
  { mode: "board", icon: SquareKanban, label: landing.showcase.board },
  { mode: "list", icon: ListTodo, label: landing.showcase.list },
  {
    mode: "calendar",
    icon: CalendarRange,
    label: messages.tasks.calendar.title,
  },
  { mode: "gantt", icon: CalendarDays, label: landing.showcase.gantt },
] satisfies { mode: PreviewMode; icon: typeof SquareKanban; label: string }[];

const tourTargets = [
  "drag-forward",
  "list",
  "calendar",
  "gantt",
  "board",
  "drag-back",
  "project-other",
  "project-main",
];

const poofParticles = [
  [0, -34],
  [25, -25],
  [36, 0],
  [25, 25],
  [0, 34],
  [-25, 25],
  [-36, 0],
  [-25, -25],
] as const;

type CursorState = {
  x: number;
  y: number;
  pressed: boolean;
  hand: "pointing" | "open" | "closed";
};

function waitForTour(ms: number, signal: AbortSignal) {
  return new Promise<boolean>((resolve) => {
    if (signal.aborted) return resolve(false);
    const abort = () => {
      window.clearTimeout(timer);
      resolve(false);
    };
    const timer = window.setTimeout(() => {
      signal.removeEventListener("abort", abort);
      resolve(true);
    }, ms);
    signal.addEventListener("abort", abort, { once: true });
  });
}

export function ProductShowcase() {
  const root = useRef<HTMLElement>(null);
  const screen = useRef<HTMLDivElement>(null);
  const cursorElement = useRef<HTMLDivElement>(null);
  const preview = useRef<AppPreviewHandle>(null);
  const movedTask = useRef<string | null>(null);
  const interrupted = useRef(false);
  const nextTarget = useRef(0);
  const [active, setActive] = useState<PreviewMode>("board");
  const [paused, setPaused] = useState(false);
  const [visible, setVisible] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(true);
  const [pageVisible, setPageVisible] = useState(true);
  const [cursorReady, setCursorReady] = useState(false);
  const [poof, setPoof] = useState<{ x: number; y: number } | null>(null);
  const [cursor, setCursor] = useState<CursorState>({
    x: 0,
    y: 0,
    pressed: false,
    hand: "pointing",
  });
  const playing = !paused && !reducedMotion && visible && pageVisible;

  const stopTour = useCallback(() => {
    // Stop synchronously, including a click already queued by the demonstration.
    interrupted.current = true;
    setCursorReady(false);
    setPaused(true);
  }, []);

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncMotion = () => setReducedMotion(preference.matches);
    const syncVisibility = () => setPageVisible(!document.hidden);
    syncMotion();
    syncVisibility();
    preference.addEventListener("change", syncMotion);
    document.addEventListener("visibilitychange", syncVisibility);
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { threshold: 0.25 },
    );
    if (root.current) observer.observe(root.current);
    return () => {
      observer.disconnect();
      preference.removeEventListener("change", syncMotion);
      document.removeEventListener("visibilitychange", syncVisibility);
    };
  }, []);

  useEffect(() => {
    if (!playing || !screen.current) return;
    const controller = new AbortController();
    const { signal } = controller;
    const initial = screen.current.getBoundingClientRect();
    setCursorReady(true);
    setCursor({
      x: initial.width * 0.6,
      y: initial.height * 0.45,
      pressed: false,
      hand: "pointing",
    });

    async function dragTask(back: boolean) {
      const container = screen.current;
      if (!container) return;
      const card = back
        ? Array.from(
            container.querySelectorAll<HTMLButtonElement>("[data-task-id]"),
          ).find((element) => element.dataset.taskId === movedTask.current)
        : container.querySelector<HTMLButtonElement>(
            '[data-column-id="to-do"] [data-task-id]',
          );
      const sourceColumn = card?.closest<HTMLElement>("[data-column-id]");
      const status = back ? "to-do" : "in-progress";
      const destination = container.querySelector<HTMLElement>(
        `[data-column-id="${status}"]`,
      );
      if (!card || !sourceColumn || !destination) return;
      const bounds = container.getBoundingClientRect();
      const from = card.getBoundingClientRect();
      const to = destination.getBoundingClientRect();
      if (from.left < bounds.left || to.right > bounds.right) return;
      const x = from.left - bounds.left + from.width / 2;
      const y = from.top - bounds.top + 28;
      setCursor({ x, y, pressed: false, hand: "open" });
      if (!(await waitForTour(850, signal)) || interrupted.current) return;

      const scale = from.width / card.offsetWidth;
      const ghost = document.createElement("div");
      ghost.className = styles.draggedCard;
      ghost.dataset.tourDrag = "";
      ghost.setAttribute("aria-hidden", "true");
      ghost.inert = true;
      Object.assign(ghost.style, {
        left: `${from.left - bounds.left}px`,
        top: `${from.top - bounds.top}px`,
        width: `${from.width}px`,
        height: `${from.height}px`,
      });
      const copy = card.cloneNode(true) as HTMLButtonElement;
      copy.removeAttribute("data-task-id");
      Object.assign(copy.style, {
        width: `${card.offsetWidth}px`,
        height: `${card.offsetHeight}px`,
        transform: `scale(${scale})`,
        transformOrigin: "top left",
      });
      ghost.append(copy);
      container.append(ghost);
      const previousOpacity = card.style.opacity;
      card.style.opacity = "0.2";
      setCursor({ x, y, pressed: true, hand: "closed" });
      let animation: Animation | undefined;
      try {
        if (!(await waitForTour(200, signal)) || interrupted.current) return;
        const dx = to.left - sourceColumn.getBoundingClientRect().left;
        setCursor({ x: x + dx, y, pressed: true, hand: "closed" });
        animation = ghost.animate(
          [
            { transform: "translate(0, 0) rotate(-2deg) scale(1.02)" },
            { transform: `translate(${dx}px, 0) rotate(0deg) scale(1.02)` },
          ],
          {
            duration: 1100,
            easing: "cubic-bezier(0.77, 0, 0.175, 1)",
            fill: "forwards",
          },
        );
        if (!(await waitForTour(1100, signal)) || interrupted.current) return;
        const taskId = card.dataset.taskId;
        if (taskId) {
          preview.current?.moveTask(taskId, status);
          movedTask.current = back ? null : taskId;
        }
        setCursor({ x: x + dx, y, pressed: false, hand: "open" });
        await waitForTour(50, signal);
      } finally {
        animation?.cancel();
        ghost.remove();
        card.style.opacity = previousOpacity;
      }
    }

    async function runTour() {
      if (!(await waitForTour(1800, signal))) return;
      while (!signal.aborted && !interrupted.current) {
        const container = screen.current;
        if (!container) return;
        const action = tourTargets[nextTarget.current];
        nextTarget.current = (nextTarget.current + 1) % tourTargets.length;
        if (action === "drag-forward" || action === "drag-back") {
          await dragTask(action === "drag-back");
          if (!(await waitForTour(2400, signal))) return;
          continue;
        }
        const target = container.querySelector<HTMLButtonElement>(
          `[data-tour-target="${action}"]`,
        );
        const bounds = container.getBoundingClientRect();
        const rect = target?.getBoundingClientRect();
        // Sidebar actions can be absent or cropped on a narrow screen.
        if (
          !target ||
          !rect ||
          rect.width === 0 ||
          rect.height === 0 ||
          rect.left < bounds.left ||
          rect.right > bounds.right
        ) {
          if (!(await waitForTour(200, signal))) return;
          continue;
        }
        setCursor({
          x: rect.left - bounds.left + rect.width / 2,
          y: rect.top - bounds.top + rect.height / 2,
          pressed: false,
          hand: "pointing",
        });
        if (!(await waitForTour(800, signal)) || interrupted.current) return;
        setCursor((current) => ({ ...current, pressed: true }));
        // Use the preview's real handlers, so the tour and manual controls stay in sync.
        target.click();
        if (!(await waitForTour(160, signal))) return;
        setCursor((current) => ({ ...current, pressed: false }));
        if (!(await waitForTour(3000, signal))) return;
      }
    }
    void runTour();
    return () => controller.abort();
  }, [playing]);

  return (
    <section
      ref={root}
      aria-label={landing.showcase.label}
      data-scene={active}
      data-playing={playing}
    >
      <div
        ref={screen}
        id="product-scene"
        className={styles.screen}
        onPointerDownCapture={() => {
          if (playing && cursorReady && !interrupted.current) {
            const hand = cursorElement.current?.querySelector(
              `[data-pose="${cursor.hand}"]`,
            );
            const bounds = screen.current?.getBoundingClientRect();
            const rect = hand?.getBoundingClientRect();
            // Read the rendered position while the cursor may still be in transit.
            if (bounds && rect) {
              setPoof({
                x: rect.left - bounds.left + rect.width / 2,
                y: rect.top - bounds.top + rect.height / 2,
              });
            }
          }
          stopTour();
        }}
        onKeyDownCapture={stopTour}
        onFocusCapture={stopTour}
      >
        <AppPreview mode={active} onModeChange={setActive} tourRef={preview} />
        {playing && cursorReady && (
          <div
            ref={cursorElement}
            className={styles.cursor}
            style={{ transform: `translate(${cursor.x}px, ${cursor.y}px)` }}
            data-pressed={cursor.pressed}
            data-hand={cursor.hand}
            aria-hidden="true"
          >
            <span className={styles.clickPulse} />
            {(["pointing", "open", "closed"] as const).map((hand) => (
              <Image
                key={hand}
                className={styles.cursorHand}
                data-pose={hand}
                src={`/cursors/${hand}-hand.svg`}
                width={64}
                height={68}
                alt=""
                draggable={false}
                unoptimized
                loading="eager"
              />
            ))}
          </div>
        )}
        {poof && (
          <div
            className={styles.poof}
            style={{ transform: `translate(${poof.x}px, ${poof.y}px)` }}
            onAnimationEnd={() => setPoof(null)}
            aria-hidden="true"
          >
            {poofParticles.map(([x, y]) => (
              <span
                key={`${x},${y}`}
                className={styles.poofParticle}
                style={
                  {
                    "--poof-x": `${x}px`,
                    "--poof-y": `${y}px`,
                  } as CSSProperties
                }
              />
            ))}
          </div>
        )}
      </div>
      <fieldset
        className={styles.controls}
        aria-label={landing.showcase.controls}
      >
        {scenes.map(({ mode, icon: Icon, label }) => (
          <button
            key={mode}
            type="button"
            onFocus={stopTour}
            aria-pressed={active === mode}
            aria-controls="product-scene"
            className={styles.sceneButton}
            onClick={() => {
              stopTour();
              setActive(mode);
            }}
          >
            <Icon size={14} aria-hidden="true" />
            <span>{label}</span>
          </button>
        ))}
        {!reducedMotion && (
          <button
            type="button"
            className={styles.playButton}
            aria-label={paused ? landing.showcase.play : landing.showcase.pause}
            onClick={() => {
              interrupted.current = !paused;
              setPoof(null);
              setCursorReady(false);
              setPaused(!paused);
            }}
          >
            {paused ? (
              <Play size={14} aria-hidden="true" />
            ) : (
              <Pause size={14} aria-hidden="true" />
            )}
          </button>
        )}
      </fieldset>
    </section>
  );
}
