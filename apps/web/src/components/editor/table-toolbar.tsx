import type { Editor } from "@tiptap/core";
import {
  BetweenHorizontalEnd,
  BetweenHorizontalStart,
  BetweenVerticalEnd,
  BetweenVerticalStart,
  Columns3,
  Grid2x2X,
  Rows3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

export function TableToolbar({
  editor,
  className,
  labels,
}: {
  editor: Editor;
  className: string;
  labels: {
    addColumnBefore: string;
    addColumnAfter: string;
    deleteColumn: string;
    addRowBefore: string;
    addRowAfter: string;
    deleteRow: string;
    deleteTable: string;
  };
}) {
  const actions = [
    { command: "addColumnBefore", icon: BetweenVerticalStart },
    { command: "addColumnAfter", icon: BetweenVerticalEnd },
    {
      command: "deleteColumn",
      icon: Columns3,
      destructive: true,
      separator: true,
    },
    { command: "addRowBefore", icon: BetweenHorizontalStart },
    { command: "addRowAfter", icon: BetweenHorizontalEnd },
    { command: "deleteRow", icon: Rows3, destructive: true, separator: true },
    { command: "deleteTable", icon: Grid2x2X, destructive: true },
  ] as const;
  return actions.map((action) => (
    <span key={action.command} className="contents">
      <Button
        type="button"
        variant="ghost"
        size="xs"
        className={cn(className, "destructive" in action && "text-destructive")}
        title={labels[action.command]}
        aria-label={labels[action.command]}
        onClick={() => editor.chain().focus()[action.command]().run()}
      >
        <action.icon className="size-3.5" />
      </Button>
      {"separator" in action && (
        <span className="kaneo-tiptap-bubble-separator" />
      )}
    </span>
  ));
}
