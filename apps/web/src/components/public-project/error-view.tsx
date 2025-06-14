import { ExternalLink } from "lucide-react";
import { KaneoBranding } from "./kaneo-branding";

export function ErrorView() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900 flex flex-col w-full">
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-6">
          <div className="w-20 h-20 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto">
            <ExternalLink className="w-10 h-10 text-red-600 dark:text-red-400" />
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">
              Project Not Found
            </h1>
            <p className="text-zinc-600 dark:text-zinc-400 max-w-md mx-auto">
              This project doesn't exist or is not publicly accessible.
            </p>
          </div>
          <KaneoBranding />
        </div>
      </div>
    </div>
  );
}
