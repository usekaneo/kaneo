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
import { AgentModelLogo } from "./agent-model-logo";

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
            className="h-7 min-w-0 max-w-48 gap-1.5 px-2 text-muted-foreground"
            aria-label={t("agent:composer.model", { model: label })}
          />
        }
      >
        {model && <AgentModelLogo modelId={model} />}
        <span className="truncate">{label}</span>
        <ChevronDown aria-hidden="true" className="size-3.5 shrink-0" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56">
        <DropdownMenuRadioGroup value={model} onValueChange={setModel}>
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
