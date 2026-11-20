import { ChevronRight } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Collapsible,
  CollapsiblePanel,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Switch } from "@/components/ui/switch";
import { useUserPreferencesStore } from "@/store/user-preferences";
import { ColumnBackdropSliders } from "./column-backdrop-sliders";

export function ProjectBackgroundSwitch() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const checked = useUserPreferencesStore(
    (state) => state.showProjectBackgrounds,
  );
  const setChecked = useUserPreferencesStore(
    (state) => state.setShowProjectBackgrounds,
  );
  const label = t("tasks:display.projectBackground");

  return (
    <Collapsible open={checked && open} onOpenChange={setOpen}>
      <div className="flex items-center justify-between gap-3">
        <CollapsibleTrigger
          disabled={!checked}
          className="group -ml-1 flex items-center gap-1 text-sm disabled:cursor-default"
        >
          <ChevronRight className="size-3.5 text-muted-foreground transition-transform group-disabled:opacity-40 group-data-panel-open:rotate-90" />
          {label}
        </CollapsibleTrigger>
        <Switch
          aria-label={label}
          checked={checked}
          onCheckedChange={setChecked}
        />
      </div>
      <CollapsiblePanel>
        <ColumnBackdropSliders />
      </CollapsiblePanel>
    </Collapsible>
  );
}
