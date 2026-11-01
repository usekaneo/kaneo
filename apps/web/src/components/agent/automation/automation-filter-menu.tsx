import { Plus, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Menu,
  MenuPopup,
  MenuRadioGroup,
  MenuRadioItem,
  MenuTrigger,
} from "@/components/ui/menu";

type AutomationFilterMenuProps = {
  label: string;
  options: { id: string; label: string }[];
  value: string | undefined;
  onValueChange: (value: string | undefined) => void;
};

// A "+ Project" style chip; once set it shows the choice and can be cleared.
export function AutomationFilterMenu({
  label,
  options,
  value,
  onValueChange,
}: AutomationFilterMenuProps) {
  const { t } = useTranslation();
  const selected = options.find((option) => option.id === value);

  return (
    <div className="flex items-center">
      <Menu>
        <MenuTrigger
          render={
            <Button
              variant="outline"
              size="xs"
              className={
                selected
                  ? "max-w-48 rounded-e-none border-e-0"
                  : "border-dashed text-muted-foreground"
              }
            />
          }
        >
          {selected ? (
            <span className="truncate">
              {label}: {selected.label}
            </span>
          ) : (
            <>
              <Plus aria-hidden="true" />
              {label}
            </>
          )}
        </MenuTrigger>
        <MenuPopup align="end" className="max-h-80 min-w-48">
          <MenuRadioGroup
            value={value ?? ""}
            onValueChange={(next: string) => onValueChange(next || undefined)}
          >
            {options.map((option) => (
              <MenuRadioItem key={option.id} value={option.id} closeOnClick>
                <span className="truncate">{option.label}</span>
              </MenuRadioItem>
            ))}
          </MenuRadioGroup>
        </MenuPopup>
      </Menu>
      {selected && (
        <Button
          variant="outline"
          size="icon-xs"
          className="rounded-s-none"
          aria-label={t("agent:automations.filters.clear", { name: label })}
          onClick={() => onValueChange(undefined)}
        >
          <X aria-hidden="true" />
        </Button>
      )}
    </div>
  );
}
