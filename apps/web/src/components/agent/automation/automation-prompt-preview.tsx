import { ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  Collapsible,
  CollapsiblePanel,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { AgentPromptText } from "../mention/agent-prompt-text";

export function AutomationPromptPreview({ prompt }: { prompt: string }) {
  const { t } = useTranslation();
  return (
    <Collapsible>
      <CollapsibleTrigger className="group flex items-center gap-1 text-muted-foreground text-sm outline-none hover:text-foreground focus-visible:text-foreground">
        <ChevronRight
          aria-hidden="true"
          className="size-3.5 transition-transform group-data-panel-open:rotate-90"
        />
        {t("agent:automations.form.prompt")}
      </CollapsibleTrigger>
      <CollapsiblePanel>
        <p className="mt-2 whitespace-pre-wrap break-words rounded-xl bg-muted/50 px-4 py-3 text-foreground text-sm leading-relaxed">
          <AgentPromptText prompt={prompt} />
        </p>
      </CollapsiblePanel>
    </Collapsible>
  );
}
