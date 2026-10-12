import { motion, useReducedMotion } from "framer-motion";
import { PanelLeft } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { PreviewBoard, type PreviewTask } from "./preview-board";
import type { PreviewFocus } from "./preview-focus";
import { PreviewSidebar } from "./preview-sidebar";

type WorkspacePreviewProps = {
  label: string;
  workspaceName: string;
  projectName: string | null;
  tasks: PreviewTask[] | null;
  focus: PreviewFocus;
  ownerInitial: string;
  invitedInitials: string[];
  emptySeats: number;
  showMembers: boolean;
  opening: boolean;
  onOpened: () => void;
};

type Zoom = { scale: number; x: number; y: number };

export function WorkspacePreview({
  label,
  workspaceName,
  projectName,
  tasks,
  focus,
  ownerInitial,
  invitedInitials,
  emptySeats,
  showMembers,
  opening,
  onOpened,
}: WorkspacePreviewProps) {
  const windowRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const [zoom, setZoom] = useState<Zoom | null>(null);

  useLayoutEffect(() => {
    if (!opening) return;
    const rect = windowRef.current?.getBoundingClientRect();
    if (reduceMotion || !rect || rect.width === 0) {
      onOpened();
      return;
    }
    const scale =
      Math.max(
        window.innerWidth / rect.width,
        window.innerHeight / rect.height,
      ) * 1.04;
    setZoom({
      scale,
      x: window.innerWidth / 2 - (rect.left + rect.width / 2),
      y: window.innerHeight / 2 - (rect.top + rect.height / 2),
    });
  }, [opening, reduceMotion, onOpened]);

  return (
    <div
      aria-hidden="true"
      className={cn(
        "relative hidden min-w-0 flex-1 border-border border-l bg-sidebar lg:block",
        zoom ? "z-10 overflow-visible" : "overflow-hidden",
      )}
    >
      <div className="absolute top-[76px] left-[72px] flex items-center gap-2">
        <span className="size-1.5 rounded-full bg-success shadow-[0_0_0_3px_--theme(--color-success/25%)]" />
        <span className="font-mono text-[11px] text-muted-foreground uppercase tracking-[0.06em]">
          {label}
        </span>
      </div>
      <motion.div
        ref={windowRef}
        animate={zoom ?? { scale: 1, x: 0, y: 0 }}
        transition={{ duration: 0.7, ease: [0.65, 0, 0.35, 1] }}
        onAnimationComplete={() => {
          if (zoom) onOpened();
        }}
        className="absolute top-[120px] left-[72px] flex h-[680px] w-[980px] rounded-[14px] border border-border bg-sidebar py-2 shadow-2xl"
      >
        <PreviewSidebar
          workspaceName={workspaceName}
          projectName={projectName}
          focus={focus}
          ownerInitial={ownerInitial}
          invitedInitials={invitedInitials}
          emptySeats={emptySeats}
          showMembers={showMembers}
        />
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-s-xl border border-border border-e-0 bg-background">
          <div className="flex h-11 shrink-0 items-center gap-2.5 border-border border-b px-4 text-[13px] text-muted-foreground">
            <PanelLeft className="size-3.5" />
            <span className="h-3.5 w-px bg-border" />
            <span className="truncate">{workspaceName}</span>
            {projectName ? (
              <>
                <span>/</span>
                <span className="truncate">{projectName}</span>
              </>
            ) : null}
          </div>
          <PreviewBoard tasks={tasks} />
        </div>
      </motion.div>
    </div>
  );
}
