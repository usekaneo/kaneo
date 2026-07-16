import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials } from "@/lib/get-initials";

export type MentionMember = {
  id: string;
  label: string;
  image?: string | null;
};

export type MentionListRef = {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
};

type MentionListProps = {
  items: MentionMember[];
  command: (item: MentionMember) => void;
};

const MentionList = forwardRef<MentionListRef, MentionListProps>(
  ({ items, command }, ref) => {
    const [selected, setSelected] = useState(0);

    // biome-ignore lint/correctness/useExhaustiveDependencies: reset on items change
    useEffect(() => setSelected(0), [items]);

    const select = (index: number) => {
      const item = items[index];
      if (item) command(item);
    };

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }) => {
        if (items.length === 0) return false;
        if (event.key === "ArrowUp") {
          setSelected((s) => (s + items.length - 1) % items.length);
          return true;
        }
        if (event.key === "ArrowDown") {
          setSelected((s) => (s + 1) % items.length);
          return true;
        }
        if (event.key === "Enter") {
          select(selected);
          return true;
        }
        return false;
      },
    }));

    if (items.length === 0) return null;

    return (
      <div className="kaneo-mention-list">
        {items.map((item, index) => (
          <button
            type="button"
            key={item.id}
            className={`kaneo-mention-item${index === selected ? " is-active" : ""}`}
            onClick={() => select(index)}
            onMouseEnter={() => setSelected(index)}
          >
            <Avatar className="h-5 w-5">
              <AvatarImage src={item.image ?? ""} alt={item.label} />
              <AvatarFallback className="text-[9px] font-medium">
                {getInitials(item.label)}
              </AvatarFallback>
            </Avatar>
            <span className="truncate">{item.label}</span>
          </button>
        ))}
      </div>
    );
  },
);

MentionList.displayName = "MentionList";

export default MentionList;
