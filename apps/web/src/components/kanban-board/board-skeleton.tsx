import { Skeleton } from "@/components/ui/skeleton";

const skeletonColumns = [
  { key: "col-todo", cards: 3 },
  { key: "col-progress", cards: 4 },
  { key: "col-review", cards: 2 },
  { key: "col-done", cards: 1 },
];

export default function BoardSkeleton() {
  return (
    <div className="delayed-reveal flex h-full w-full overflow-hidden bg-linear-to-b from-muted/20 to-background">
      <div className="flex h-full min-w-max gap-4 px-4 py-4 md:px-5">
        {skeletonColumns.map((col) => (
          <div
            key={col.key}
            className="flex h-full max-w-96 min-w-[min(20rem,calc(100vw-4.5rem))] shrink-0 flex-1 flex-col"
          >
            <div className="flex h-8 shrink-0 items-center gap-2 mt-1 pr-2 pl-3">
              <Skeleton className="size-3.5 rounded-full" />
              <Skeleton className="h-3 w-24" />
            </div>
            <div className="flex flex-col gap-2 px-1.5 pt-1.5">
              {Array.from(
                { length: col.cards },
                (_, i) => `${col.key}-${i}`,
              ).map((cardKey) => (
                <div
                  key={cardKey}
                  className="flex flex-col gap-2.5 rounded-[10px] border border-board-card-border bg-board-card p-3"
                >
                  <Skeleton className="h-3 w-12" />
                  <Skeleton className="h-3.5 w-4/5" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
