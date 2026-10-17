import { Skeleton } from "@/components/ui/skeleton";

const SECTIONS = [
  { id: "events", rows: ["assignments", "comments", "status", "reminders"] },
  { id: "channels", rows: ["email", "gotify", "ntfy", "webhook"] },
  { id: "workspaces", rows: ["first", "second"] },
];

export function NotificationSettingsSkeleton() {
  return (
    <div aria-hidden="true" className="space-y-10">
      {SECTIONS.map((section) => (
        <div key={section.id} className="space-y-3">
          <div className="space-y-1.5">
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="h-3 w-64 max-w-full" />
          </div>
          <div className="divide-y divide-border rounded-xl border border-border bg-card">
            {section.rows.map((row) => (
              <div key={row} className="flex items-center gap-3.5 px-4 py-3.5">
                <div className="min-w-0 flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-32" />
                  <Skeleton className="h-3 w-56 max-w-full" />
                </div>
                <Skeleton className="h-5 w-9 rounded-full" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
