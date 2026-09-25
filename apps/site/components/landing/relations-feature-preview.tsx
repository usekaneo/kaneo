"use client";

import { ArrowLeft, ArrowUpRight, ChevronDown } from "lucide-react";
import { useRef, useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { getColumnIcon } from "@/lib/column";
import { landing } from "@/lib/landing";
import messages from "../../../../i18n/en-US.json";
import styles from "./features.module.css";

const copy = landing.features.preview;
const tasks = {
  homepage: {
    number: 24,
    title: copy.taskTitle,
    description: copy.dependencyDescription,
    status: "in-progress",
    statusLabel: copy.inProgress,
    initials: "PB",
  },
  mobile: {
    number: 26,
    title: copy.checklistOpen,
    description: copy.mobileDescription,
    status: "in-review",
    statusLabel: copy.inReview,
    initials: "PB",
  },
  notes: {
    number: 31,
    title: copy.releaseNotes,
    description: copy.notesDescription,
    status: "in-progress",
    statusLabel: copy.inProgress,
    initials: "JH",
  },
};
type TaskKey = keyof typeof tasks;
const connections: Record<
  TaskKey,
  { type: "blocked_by" | "blocks" | "related"; target: TaskKey }[]
> = {
  homepage: [
    { type: "blocked_by", target: "mobile" },
    { type: "related", target: "notes" },
  ],
  mobile: [{ type: "blocks", target: "homepage" }],
  notes: [{ type: "related", target: "homepage" }],
};

// Uses task-relations.tsx's grouped rows and task-sheet navigation, with local
// sample tasks so the preview never opens or modifies a real workspace.
export function RelationsFeaturePreview() {
  const [selected, setSelected] = useState<TaskKey>("homepage");
  const headingRef = useRef<HTMLHeadingElement>(null);
  const task = tasks[selected];
  function openTask(next: TaskKey) {
    setSelected(next);
    headingRef.current?.focus({ preventScroll: true });
  }
  return (
    <figure
      className={styles.preview}
      data-preview="relations"
      aria-label={copy.relationsAlt}
    >
      <div className={styles.previewHeader}>
        <div className="flex items-center gap-2">
          {selected !== "homepage" && (
            <Button
              size="icon-xs"
              variant="ghost"
              onClick={() => openTask("homepage")}
              aria-label={copy.backToTask}
            >
              <ArrowLeft className="size-3.5" />
            </Button>
          )}
          <span>WEB-{task.number}</span>
        </div>
        <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
          {getColumnIcon(task.status)}
          {task.statusLabel}
        </span>
      </div>
      <div className={`${styles.previewBody} ${styles.relationsBody}`}>
        <div className="flex flex-col gap-2.5">
          <h3
            ref={headingRef}
            tabIndex={-1}
            className={`${styles.taskTitle} outline-none`}
            aria-live="polite"
          >
            {task.title}
          </h3>
          <p className={styles.taskDescription}>{task.description}</p>
        </div>
        <div className="w-full">
          <div className="flex items-center gap-1.5 mb-3">
            <span className="flex items-center gap-1 text-sm text-muted-foreground">
              <ChevronDown className="size-4" />
              {messages.tasks.relations.title}
            </span>
            <span className="text-xs text-muted-foreground">
              {connections[selected].length}
            </span>
          </div>
          <div className="flex flex-col gap-3">
            {connections[selected].map(({ type, target }) => (
              <div key={target}>
                <span className="text-[11px] text-muted-foreground/70 px-2">
                  {messages.tasks.relations.types[type]}
                </span>
                <button
                  type="button"
                  onClick={() => openTask(target)}
                  className={`${styles.interactiveRow} ${styles.relationRow}`}
                >
                  <span className="shrink-0" aria-hidden="true">
                    {getColumnIcon(tasks[target].status)}
                  </span>
                  <span className="text-sm text-foreground/90 text-left flex-1 min-w-0">
                    {tasks[target].title}
                  </span>
                  <span className={styles.rowDetail}>
                    {tasks[target].statusLabel}
                  </span>
                  <Avatar className="h-5 w-5" aria-hidden="true">
                    <AvatarFallback className="text-[9px] font-medium border border-border/30">
                      {tasks[target].initials}
                    </AvatarFallback>
                  </Avatar>
                  <ArrowUpRight
                    className={styles.rowArrow}
                    aria-hidden="true"
                  />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
      <figcaption className={styles.previewFooter}>
        {copy.tryRelations}
      </figcaption>
    </figure>
  );
}
