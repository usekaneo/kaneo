import { PanelLeft } from "lucide-react";
import { PreviewBoard, type PreviewTask } from "./preview-board";
import { PreviewSidebar } from "./preview-sidebar";

type WorkspacePreviewProps = {
  workspaceName: string;
  projectName: string | null;
  tasks: PreviewTask[] | null;
};

export function WorkspacePreview({
  workspaceName,
  projectName,
  tasks,
}: WorkspacePreviewProps) {
  return (
    <div
      aria-hidden="true"
      className="relative hidden min-w-0 flex-1 overflow-hidden border-border border-l bg-sidebar lg:block"
    >
      <div className="absolute top-1/2 left-[72px] flex h-[680px] w-[980px] -translate-y-1/2 rounded-[14px] border border-border bg-sidebar py-2 shadow-2xl">
        <PreviewSidebar
          workspaceName={workspaceName}
          projectName={projectName}
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
      </div>
    </div>
  );
}
