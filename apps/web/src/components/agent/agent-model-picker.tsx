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
import { useAgentModel } from "@/hooks/use-agent-model";

export function AgentModelPicker({ workspaceId }: { workspaceId: string }) {
  const { t } = useTranslation();
  const { models, model, setModel } = useAgentModel(workspaceId);
  if (models.length < 2) return null;
  const label = models.find((item) => item.id === model)?.label ?? model ?? "";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className="h-7 min-w-0 max-w-44 gap-1 px-2 text-muted-foreground"
            aria-label={t("agent:composer.model", { model: label })}
          />
        }
      >
        <span className="truncate">{label}</span>
        <ChevronDown aria-hidden="true" className="size-3.5 shrink-0" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56">
        <DropdownMenuRadioGroup value={model} onValueChange={setModel}>
          {models.map((item) => (
            <DropdownMenuRadioItem key={item.id} value={item.id} closeOnClick>
              {item.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
