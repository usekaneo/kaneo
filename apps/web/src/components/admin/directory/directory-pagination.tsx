import { Button } from "@/components/ui/button";

type DirectoryPaginationProps = {
  page: number;
  pageCount: number;
  disabled: boolean;
  onPageChange: (page: number) => void;
  label: string;
  previousLabel: string;
  nextLabel: string;
};

export function DirectoryPagination({
  page,
  pageCount,
  disabled,
  onPageChange,
  label,
  previousLabel,
  nextLabel,
}: DirectoryPaginationProps) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-2.5">
      <p className="text-xs text-muted-foreground tabular-nums">{label}</p>
      <div className="flex items-center gap-1.5">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={page === 0 || disabled}
          onClick={() => onPageChange(Math.max(0, page - 1))}
        >
          {previousLabel}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={page + 1 >= pageCount || disabled}
          onClick={() => onPageChange(page + 1)}
        >
          {nextLabel}
        </Button>
      </div>
    </div>
  );
}
