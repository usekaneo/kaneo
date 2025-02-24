import { AlertTriangle } from "lucide-react";
import { Button } from "./ui/button";

export function DemoAlert() {
  return (
    <div className="flex flex-col min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-3 sm:py-2 text-center">
        <div className="flex flex-col sm:flex-row items-center justify-center gap-2 text-sm text-amber-900 dark:text-amber-300">
          <AlertTriangle className="w-5 h-5 sm:w-4 sm:h-4 mb-1 sm:mb-0" />
          <p className="flex flex-col sm:flex-row items-center gap-2">
            This is a demo environment. All data will be automatically purged
            every 24 hours.
            <Button
              onClick={() =>
                window.open("https://github.com/kaneo-app/app", "_blank")
              }
              className="text-xs bg-amber-500/10 hover:bg-amber-500/20 text-amber-900 dark:text-amber-300 h-7 sm:h-6 px-3 sm:px-2 whitespace-nowrap"
            >
              Deploy your own
            </Button>
          </p>
        </div>
      </div>
    </div>
  );
}
