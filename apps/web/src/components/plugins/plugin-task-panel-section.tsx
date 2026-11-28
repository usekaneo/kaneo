import { ChevronRight } from "lucide-react";
import { type ReactNode, useState } from "react";
import { SectionHeader } from "@/components/task/sections/section-header";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

type PluginTaskPanelSectionProps = {
  title: string;
  children: ReactNode;
};

export function PluginTaskPanelSection({
  title,
  children,
}: PluginTaskPanelSectionProps) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <section className="flex flex-col gap-1">
        <SectionHeader
          title={
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-1 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {title}
                {!isOpen && (
                  <ChevronRight
                    aria-hidden="true"
                    className="size-3 text-muted-foreground"
                  />
                )}
              </button>
            </CollapsibleTrigger>
          }
        />
        <CollapsibleContent>{children}</CollapsibleContent>
      </section>
    </Collapsible>
  );
}
