import { ArrowDownAZ, ArrowUpAZ } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/menu";
import type { SortConfig, SortDirection, SortField } from "@/lib/sort-tasks";

type SortControlProps = {
  sort: SortConfig;
  onSortChange: (sort: SortConfig) => void;
};

const sortFields: { field: SortField; label: string }[] = [
  { field: "position", label: "Manual (position)" },
  { field: "createdAt", label: "Created date" },
  { field: "priority", label: "Priority" },
  { field: "dueDate", label: "Due date" },
  { field: "title", label: "Title" },
  { field: "number", label: "Task number" },
];

function CheckSlot({ checked }: { checked: boolean }) {
  return (
    <span
      className={`inline-flex size-4 shrink-0 items-center justify-center rounded-[4px] border ${
        checked
          ? "border-primary bg-primary text-primary-foreground"
          : "border-input bg-background"
      }`}
    >
      {checked ? "\u2713" : null}
    </span>
  );
}

export default function SortControl({ sort, onSortChange }: SortControlProps) {
  const isActive = sort.field !== "position";
  const activeLabel = sortFields.find((f) => f.field === sort.field)?.label;

  const handleFieldChange = (field: SortField) => {
    if (field === "position" || field === sort.field) {
      onSortChange({ field: "position", direction: "asc" });
    } else {
      const defaultDirection: SortDirection =
        field === "priority" ? "desc" : "asc";
      onSortChange({ field, direction: defaultDirection });
    }
  };

  const toggleDirection = () => {
    onSortChange({
      ...sort,
      direction: sort.direction === "asc" ? "desc" : "asc",
    });
  };

  return (
    <div className="inline-flex items-center gap-1">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              className={`inline-flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium outline-none ring-0 ${
                isActive
                  ? "border-primary/30 bg-primary/10 text-primary hover:bg-primary/15"
                  : "border-border bg-background text-foreground hover:bg-accent/60"
              }`}
            />
          }
        >
          {sort.direction === "asc" ? (
            <ArrowUpAZ className="h-3 w-3" />
          ) : (
            <ArrowDownAZ className="h-3 w-3" />
          )}
          {isActive ? activeLabel : "Sort"}
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-48" align="start">
          <DropdownMenuGroup>
            <DropdownMenuLabel className="text-[11px] uppercase tracking-wide">
              Sort By
            </DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          {sortFields.map(({ field, label }) => (
            <DropdownMenuItem
              key={field}
              onClick={() => handleFieldChange(field)}
              className="h-8 rounded-md text-sm"
            >
              <CheckSlot checked={sort.field === field} />
              {label}
            </DropdownMenuItem>
          ))}

          {isActive && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuLabel className="text-[11px] uppercase tracking-wide">
                  Direction
                </DropdownMenuLabel>
              </DropdownMenuGroup>
              <DropdownMenuItem
                onClick={() => onSortChange({ ...sort, direction: "asc" })}
                className="h-8 rounded-md text-sm"
              >
                <CheckSlot checked={sort.direction === "asc"} />
                Ascending
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onSortChange({ ...sort, direction: "desc" })}
                className="h-8 rounded-md text-sm"
              >
                <CheckSlot checked={sort.direction === "desc"} />
                Descending
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {isActive && (
        <button
          type="button"
          onClick={toggleDirection}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-background text-foreground hover:bg-accent/60"
          title={sort.direction === "asc" ? "Ascending" : "Descending"}
        >
          {sort.direction === "asc" ? (
            <ArrowUpAZ className="h-3 w-3" />
          ) : (
            <ArrowDownAZ className="h-3 w-3" />
          )}
        </button>
      )}
    </div>
  );
}
