import { ErrorTest } from "@/components/ui/error-test";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/test-error")({
  component: TestErrorComponent,
});

function TestErrorComponent() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900">
      <ErrorTest />
    </div>
  );
}
