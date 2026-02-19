import type {
  DefaultReactSuggestionItem,
  SuggestionMenuProps,
} from "@blocknote/react";
import { cn } from "@/lib/cn";

export default function CustomSlashMenu(
  props: SuggestionMenuProps<DefaultReactSuggestionItem>,
) {
  const { items, selectedIndex, onItemClick } = props;

  let currentGroup: string | undefined;

  const getShortcut = (badge: DefaultReactSuggestionItem["badge"]) => {
    if (typeof badge !== "string") return null;
    const value = badge.trim();
    if (!value || value.length > 14) return null;
    return value;
  };

  return (
    <div className="kaneo-slash-menu">
      {items.map((item, index) => {
        const shouldShowGroup = item.group && item.group !== currentGroup;
        currentGroup = item.group;
        const shortcut = getShortcut(item.badge);

        return (
          <div key={`${item.title}-${index}`}>
            {shouldShowGroup && (
              <div className="kaneo-slash-menu-label">{item.group}</div>
            )}
            <button
              type="button"
              className={cn("kaneo-slash-menu-item", {
                "is-selected": selectedIndex === index,
              })}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => onItemClick?.(item)}
            >
              {item.icon && (
                <span className="kaneo-slash-menu-icon">{item.icon}</span>
              )}
              <span className="kaneo-slash-menu-title">{item.title}</span>
              {shortcut && (
                <span className="kaneo-slash-menu-shortcut">{shortcut}</span>
              )}
            </button>
          </div>
        );
      })}
    </div>
  );
}
