import { useState } from "react";
import { Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { FilterRootPanel } from "./filter-root-panel";
import type { FilterSubject } from "./filter-subject";

export function AddFilterButton({ subjects }: { subjects: FilterSubject[] }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={t("tasks:filterMenu.addFilter")}
            className="sm:size-7"
          />
        }
      >
        <Plus />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-60">
        <FilterRootPanel subjects={subjects} onApplied={() => setOpen(false)} />
      </PopoverContent>
    </Popover>
  );
}
