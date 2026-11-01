import { ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/menu";
import { AgentModelLogo } from "./agent-model-logo";

type AgentModelMenuProps = {
  models: { id: string; label: string }[];
  value: string | null;
  onValueChange: (model: string) => void;
};

export function AgentModelMenu({
  models,
  value,
  onValueChange,
}: AgentModelMenuProps) {
  const { t } = useTranslation();
  const label = models.find((item) => item.id === value)?.label ?? value ?? "";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className="h-7 min-w-0 max-w-48 gap-1.5 px-2 text-muted-foreground"
            aria-label={t("agent:composer.model", { model: label })}
          />
        }
      >
        {value && <AgentModelLogo modelId={value} />}
        <span className="truncate">{label}</span>
        <ChevronDown aria-hidden="true" className="size-3.5 shrink-0" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56">
        <DropdownMenuRadioGroup value={value} onValueChange={onValueChange}>
          {models.map((item) => (
            <DropdownMenuRadioItem key={item.id} value={item.id} closeOnClick>
              <span className="flex min-w-0 items-center gap-2">
                <AgentModelLogo modelId={item.id} />
                <span className="truncate">{item.label}</span>
              </span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
