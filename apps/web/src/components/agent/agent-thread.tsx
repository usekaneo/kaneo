import { useEffect, useLayoutEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import type { AgentRunSummary } from "@/types/agent";
import { AgentRunItem } from "./agent-run-item";

type AgentThreadProps = {
  workspaceId: string;
  runs: AgentRunSummary[];
  isLoading: boolean;
  isError: boolean;
  hasOlder?: boolean;
  isLoadingOlder?: boolean;
  onLoadOlder?: () => void;
  getTaskKey?: (taskId: string) => string | undefined;
  readOnly?: boolean;
};

export function AgentThread({
  workspaceId,
  runs,
  isLoading,
  isError,
  hasOlder,
  isLoadingOlder,
  onLoadOlder,
  getTaskKey,
  readOnly,
}: AgentThreadProps) {
  const { t } = useTranslation();
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const pinnedRef = useRef(true);
  const olderAnchor = useRef<{
    height: number;
    top: number;
    firstId: string | undefined;
  } | null>(null);

  useLayoutEffect(() => {
    const anchor = olderAnchor.current;
    const scroller = scrollRef.current;
    if (!anchor || !scroller) return;
    if (anchor.firstId !== runs[0]?.id) {
      scroller.scrollTop = anchor.top + scroller.scrollHeight - anchor.height;
      olderAnchor.current = null;
    } else if (!isLoadingOlder) {
      olderAnchor.current = null;
    }
  }, [runs, isLoadingOlder]);

  // Follow new output while the reader stays at the bottom.
  useEffect(() => {
    const scroller = scrollRef.current;
    const content = contentRef.current;
    if (!scroller || !content) return;
    const onScroll = () => {
      pinnedRef.current =
        scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 80;
    };
    const observer = new ResizeObserver(() => {
      if (pinnedRef.current) scroller.scrollTop = scroller.scrollHeight;
    });
    scroller.addEventListener("scroll", onScroll, { passive: true });
    observer.observe(content);
    return () => {
      scroller.removeEventListener("scroll", onScroll);
      observer.disconnect();
    };
  }, []);

  return (
    <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
      <div ref={contentRef} className="flex flex-col gap-6 px-4 py-5">
        {hasOlder && onLoadOlder && (
          <div className="flex justify-center">
            <Button
              variant="ghost"
              size="sm"
              loading={isLoadingOlder}
              onClick={() => {
                const scroller = scrollRef.current;
                if (scroller) {
                  olderAnchor.current = {
                    height: scroller.scrollHeight,
                    top: scroller.scrollTop,
                    firstId: runs[0]?.id,
                  };
                  pinnedRef.current = false;
                }
                onLoadOlder();
              }}
            >
              {t("agent:thread.loadOlder")}
            </Button>
          </div>
        )}
        {isLoading && (
          <div className="flex justify-center py-6">
            <Spinner className="size-4 text-muted-foreground" />
          </div>
        )}
        {isError && (
          <p role="alert" className="text-destructive-foreground text-sm">
            {t("agent:thread.loadError")}
          </p>
        )}
        {runs.map((run) => (
          <AgentRunItem
            key={run.id}
            workspaceId={workspaceId}
            summary={run}
            getTaskKey={getTaskKey}
            readOnly={readOnly}
          />
        ))}
      </div>
    </div>
  );
}
