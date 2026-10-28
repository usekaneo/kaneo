import { Radio as RadioPrimitive } from "@base-ui/react/radio";
import { useTranslation } from "react-i18next";
import { Label } from "@/components/ui/label";
import { RadioGroup } from "@/components/ui/radio-group";
import type { AutomationOutput } from "@/types/agent-automation";
import { AUTOMATION_OUTPUT_ICONS } from "./automation-icons";
import { AutomationRadioMark } from "./automation-radio-mark";

const OUTPUTS: AutomationOutput[] = ["proposals", "digest"];

type AutomationOutputFieldProps = {
  value: AutomationOutput;
  onValueChange: (value: AutomationOutput) => void;
};

export function AutomationOutputField({
  value,
  onValueChange,
}: AutomationOutputFieldProps) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-2">
      <Label id="automation-output-label">
        {t("agent:automations.form.output")}
      </Label>
      <RadioGroup
        value={value}
        aria-labelledby="automation-output-label"
        onValueChange={(next) => onValueChange(next as AutomationOutput)}
        className="gap-0 overflow-hidden rounded-lg border border-border"
      >
        {OUTPUTS.map((output) => {
          const Icon = AUTOMATION_OUTPUT_ICONS[output];
          return (
            <RadioPrimitive.Root
              key={output}
              value={output}
              className="group flex h-10 cursor-pointer items-center gap-3 border-border/70 border-b px-3 text-left text-muted-foreground text-sm outline-none transition-colors last:border-b-0 hover:bg-muted/40 focus-visible:bg-muted/60 data-checked:bg-muted/50 data-checked:font-medium data-checked:text-foreground"
            >
              <AutomationRadioMark />
              <Icon aria-hidden="true" className="size-3.5 shrink-0" />
              {t(`agent:automations.output.${output}Long`)}
            </RadioPrimitive.Root>
          );
        })}
      </RadioGroup>
    </div>
  );
}
