import { ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";
import type { ImportSourceDefinition } from "@/components/import/import-source-definitions";
import { ImportSourceLogoTile } from "@/components/import/import-source-logo-tile";
import {
  type ImportStepNumber,
  ImportSteps,
} from "@/components/import/import-steps";
import { Button } from "@/components/ui/button";

type ImportStepLayoutProps = {
  source: ImportSourceDefinition;
  backLabel: string;
  onBack: () => void;
  current: ImportStepNumber;
  complete?: boolean;
  title: string;
  description: ReactNode;
  children: ReactNode;
};

export function ImportStepLayout({
  source,
  backLabel,
  onBack,
  current,
  complete,
  title,
  description,
  children,
}: ImportStepLayoutProps) {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-10 px-4 py-8 sm:px-8 sm:py-10">
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <Button
            variant="ghost"
            size="sm"
            className="-ms-2 text-muted-foreground hover:text-foreground"
            onClick={onBack}
          >
            <ChevronLeft aria-hidden="true" />
            {backLabel}
          </Button>
          <ImportSteps
            current={current}
            complete={complete}
            unit={source.unit}
          />
        </div>
        <header className="flex items-center gap-3.5">
          <ImportSourceLogoTile source={source} size="lg" />
          <div className="min-w-0 space-y-1">
            <h1
              tabIndex={-1}
              className="font-semibold text-xl tracking-tight outline-none"
            >
              {title}
            </h1>
            <p className="text-muted-foreground text-sm">{description}</p>
          </div>
        </header>
      </div>
      {children}
    </div>
  );
}
