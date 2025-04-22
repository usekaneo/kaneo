import { Button } from "@/components/ui/button";
import useCreateTimeEntry from "@/hooks/mutations/time-entry/use-create-time-entry";
import useUpdateTimeEntry from "@/hooks/mutations/time-entry/use-update-time-entry";
import useGetTimeEntriesByTaskId from "@/hooks/queries/time-entry/use-get-time-entries";
import { formatDuration } from "@/lib/format-duration";
import type { TimeEntry } from "@/types/time-entry";
import { format } from "date-fns";
import { Clock, Pause, Play } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface TaskTimeTrackingProps {
  taskId: string;
}

function TaskTimeTracking({ taskId }: TaskTimeTrackingProps) {
  const { data: timeEntries } = useGetTimeEntriesByTaskId(taskId);
  const { mutateAsync: createTimeEntry } = useCreateTimeEntry();
  const { mutateAsync: updateTimeEntry } = useUpdateTimeEntry(taskId);

  const [activeTimeEntry, setActiveTimeEntry] = useState<TimeEntry | null>(
    null,
  );
  const [elapsedTime, setElapsedTime] = useState(0);

  useEffect(() => {
    if (timeEntries) {
      const active = timeEntries.find((entry) => !entry.endTime);
      setActiveTimeEntry(active || null);

      if (active) {
        const startTime = new Date(active.startTime).getTime();
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        setElapsedTime(elapsed);
      }
    }
  }, [timeEntries]);

  useEffect(() => {
    if (!activeTimeEntry) return;

    const interval = setInterval(() => {
      const startTime = new Date(activeTimeEntry.startTime).getTime();
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      setElapsedTime(elapsed);
    }, 1000);

    return () => clearInterval(interval);
  }, [activeTimeEntry]);

  const startTracking = async () => {
    try {
      const newTimeEntry = await createTimeEntry({
        taskId,
        startTime: new Date().toISOString(),
      });

      setActiveTimeEntry(newTimeEntry);
      setElapsedTime(0);
      toast.success("Time tracking started");
    } catch (error) {
      toast.error("Failed to start time tracking");
    }
  };

  const stopTracking = async () => {
    if (!activeTimeEntry) return;

    try {
      await updateTimeEntry({
        id: activeTimeEntry.id,
        endTime: new Date().toISOString(),
        duration: elapsedTime,
      });

      setActiveTimeEntry(null);
      toast.success("Time tracking stopped");
    } catch (error) {
      toast.error("Failed to stop time tracking");
    }
  };

  // Calculate total time spent on task
  const totalTimeSpent =
    timeEntries?.reduce((total, entry) => {
      return total + (entry.duration || 0);
    }, 0) || 0;

  // Add active time to total
  const grandTotal = totalTimeSpent + (activeTimeEntry ? elapsedTime : 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-medium text-zinc-900 dark:text-zinc-100">
          Time Tracking
        </h2>
        <div className="flex items-center gap-2">
          {activeTimeEntry ? (
            <Button
              size="sm"
              variant="outline"
              onClick={stopTracking}
              className="flex items-center gap-1"
            >
              <Pause className="w-3.5 h-3.5" />
              Stop
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={startTracking}
              className="flex items-center gap-1"
            >
              <Play className="w-3.5 h-3.5" />
              Start
            </Button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 p-3 bg-zinc-50 dark:bg-zinc-800 rounded-md">
        <Clock className="w-5 h-5 text-zinc-500 dark:text-zinc-400" />
        <div className="flex-1">
          <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            {formatDuration(grandTotal)}
          </div>
          <div className="text-xs text-zinc-500 dark:text-zinc-400">
            {activeTimeEntry ? "Currently tracking" : "Total time spent"}
          </div>
        </div>
        {activeTimeEntry && (
          <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            {formatDuration(elapsedTime)}
          </div>
        )}
      </div>

      {timeEntries && timeEntries.length > 0 && (
        <div className="space-y-2 mt-4">
          <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            Time Log
          </h3>
          <div className="space-y-2">
            {timeEntries.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between p-2 text-sm border border-zinc-200 dark:border-zinc-800 rounded-md"
              >
                <div>
                  <div className="font-medium">
                    {entry.description || "Time entry"}
                  </div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400">
                    {format(new Date(entry.startTime), "MMM d, yyyy h:mm a")}
                    {entry.endTime && (
                      <> - {format(new Date(entry.endTime), "h:mm a")}</>
                    )}
                  </div>
                </div>
                <div className="font-medium">
                  {entry.duration ? formatDuration(entry.duration) : "00:00"}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default TaskTimeTracking;
