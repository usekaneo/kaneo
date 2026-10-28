import { cn } from "@/lib/cn";
import { AgentMentionIcon } from "./agent-mention-icon";
import type { AgentMentionOption } from "./to-agent-mention-options";

type AgentMentionMenuProps = {
  id: string;
  label: string;
  options: AgentMentionOption[];
  activeIndex: number;
  placement: "above" | "below";
  onSelect: (option: AgentMentionOption) => void;
  onHighlight: (index: number) => void;
};

export const agentMentionOptionId = (menuId: string, index: number) =>
  `${menuId}-${index}`;

// Focus stays in the editor; it drives this list through aria-activedescendant.
export function AgentMentionMenu({
  id,
  label,
  options,
  activeIndex,
  placement,
  onSelect,
  onHighlight,
}: AgentMentionMenuProps) {
  return (
    <div
      id={id}
      role="listbox"
      aria-label={label}
      className={cn(
        "absolute left-0 z-50 w-80 max-w-full rounded-lg border bg-popover p-1 shadow-lg/5",
        placement === "above" ? "bottom-full mb-2" : "top-full mt-2",
      )}
    >
      {options.map((option, index) => (
        <div
          key={`${option.type}:${option.id}`}
          id={agentMentionOptionId(id, index)}
          role="option"
          aria-selected={index === activeIndex}
          className="flex min-h-8 cursor-default select-none items-center gap-2 rounded-sm px-2 py-1 text-foreground text-sm aria-selected:bg-accent aria-selected:text-accent-foreground"
          tabIndex={-1}
          // Selecting on mousedown keeps focus (and the caret) in the editor.
          onMouseDown={(event) => {
            event.preventDefault();
            onSelect(option);
          }}
          onMouseEnter={() => onHighlight(index)}
        >
          <AgentMentionIcon
            type={option.type}
            className="size-3.5 text-muted-foreground"
          />
          {option.key && (
            <span className="shrink-0 font-mono text-muted-foreground text-xs">
              {option.key}
            </span>
          )}
          <span className="min-w-0 flex-1 truncate">{option.label}</span>
          {option.context && (
            <span className="max-w-28 shrink-0 truncate text-muted-foreground text-xs">
              {option.context}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
