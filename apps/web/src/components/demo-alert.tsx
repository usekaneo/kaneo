import { Button } from "./ui/button";

export function DemoAlert() {
  return (
    <div className="flex sticky top-0 left-0 right-0 flex-col bg-amber-500/10 border-b border-amber-500/20 px-4 py-3 text-center">
      <div className="flex flex-col sm:flex-row items-center justify-center gap-2 text-sm text-amber-900 dark:text-amber-300">
        <p className="flex flex-col sm:flex-row items-center gap-2">
          This is a demo environment. All data will be automatically purged
          every hour.
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
  );
}
