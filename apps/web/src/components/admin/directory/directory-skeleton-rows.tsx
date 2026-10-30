import { Skeleton } from "@/components/ui/skeleton";

const ROW_KEYS = ["first", "second", "third", "fourth", "fifth"];

type DirectorySkeletonRowsProps = {
  rows?: number;
  withAvatar?: boolean;
};

export function DirectorySkeletonRows({
  rows = ROW_KEYS.length,
  withAvatar = false,
}: DirectorySkeletonRowsProps) {
  return ROW_KEYS.slice(0, rows).map((key) => (
    <div
      key={key}
      aria-hidden="true"
      className="flex items-center gap-3 px-4 py-3"
    >
      {withAvatar ? <Skeleton className="size-7 rounded-full" /> : null}
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-3.5 w-full max-w-40" />
        <Skeleton className="h-3 w-full max-w-56" />
      </div>
    </div>
  ));
}
