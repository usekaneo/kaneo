import { Fragment } from "react";
import { useTranslation } from "react-i18next";
import { Kbd, type KbdProps } from "@/components/ui/kbd";
import { cn } from "@/lib/cn";
import { SHORTCUTS, type ShortcutId } from "@/lib/shortcuts/catalog";
import { formatBinding } from "@/lib/shortcuts/format-binding";
import { isMacPlatform } from "@/lib/shortcuts/platform";

type ShortcutKeysProps = {
  id: ShortcutId;
  size?: KbdProps["size"];
  tone?: KbdProps["tone"];
  isHighlighted?: (cap: string) => boolean;
  className?: string;
};

export function shortcutCaps(id: ShortcutId) {
  const definition = SHORTCUTS[id];
  const keys = "display" in definition ? definition.display : definition.keys;
  const isMac = isMacPlatform();
  return keys.map((binding) => formatBinding(binding, isMac));
}

type ComboCapsProps = {
  combo: string[];
  size: KbdProps["size"];
  tone: KbdProps["tone"];
  isHighlighted?: (cap: string) => boolean;
};

function ComboCaps({ combo, size, tone, isHighlighted }: ComboCapsProps) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {combo.map((cap) => (
        <Kbd
          key={cap}
          size={size}
          tone={tone}
          highlighted={isHighlighted?.(cap)}
        >
          {cap}
        </Kbd>
      ))}
    </span>
  );
}

export function ShortcutKeys({
  id,
  size = "sm",
  tone = "default",
  isHighlighted,
  className,
}: ShortcutKeysProps) {
  const { t } = useTranslation();
  const capProps = { size, tone, isHighlighted };
  const word = cn(
    "text-muted-foreground/80",
    size === "md" ? "text-xs" : "text-[11px]",
  );

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center",
        size === "md" ? "gap-[5px]" : "gap-1",
        className,
      )}
    >
      {shortcutCaps(id).map((binding, bindingIndex) => (
        <Fragment key={binding.flat().join(" ")}>
          {bindingIndex > 0 && (
            <span className={word}>{t("navigation:shortcuts.or")}</span>
          )}
          <ComboCaps combo={binding[0]} {...capProps} />
          {binding[1] && (
            <>
              <span className={word}>{t("navigation:shortcuts.then")}</span>
              <ComboCaps combo={binding[1]} {...capProps} />
            </>
          )}
        </Fragment>
      ))}
    </span>
  );
}
