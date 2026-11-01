import { Radio as RadioPrimitive } from "@base-ui/react/radio";
import { useTranslation } from "react-i18next";
import { RadioGroup } from "@/components/ui/radio-group";
import type { AutomationEventName } from "@/types/agent-automation";
import type { AutomationDraft } from "./automation-draft";
import { AutomationEventFilters } from "./automation-event-filters";
import {
  AUTOMATION_EVENT_ICONS,
  AUTOMATION_EVENT_NAMES,
} from "./automation-icons";
import { AutomationRadioMark } from "./automation-radio-mark";

type AutomationEventFieldsProps = {
  workspaceId: string;
  draft: AutomationDraft;
  onChange: (patch: Partial<AutomationDraft>) => void;
};

export function AutomationEventFields({
  workspaceId,
  draft,
  onChange,
}: AutomationEventFieldsProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-3">
      <RadioGroup
        value={draft.event}
        aria-label={t("agent:automations.form.event")}
        onValueChange={(value) =>
          onChange({ event: value as AutomationEventName })
        }
        className="gap-0 overflow-hidden rounded-lg border border-border"
      >
        {AUTOMATION_EVENT_NAMES.map((event) => {
          const Icon = AUTOMATION_EVENT_ICONS[event];
          return (
            <RadioPrimitive.Root
              key={event}
              value={event}
              className="group flex h-9 cursor-pointer items-center gap-3 border-border/70 border-b px-3 text-left text-muted-foreground text-sm outline-none transition-colors last:border-b-0 hover:bg-muted/40 focus-visible:bg-muted/60 data-checked:bg-muted/50 data-checked:font-medium data-checked:text-foreground"
            >
              <AutomationRadioMark />
              <Icon aria-hidden="true" className="size-3.5 shrink-0" />
              {t(`agent:automations.events.${event}`)}
            </RadioPrimitive.Root>
          );
        })}
      </RadioGroup>
      <AutomationEventFilters
        workspaceId={workspaceId}
        draft={draft}
        onChange={onChange}
      />
    </div>
  );
}
