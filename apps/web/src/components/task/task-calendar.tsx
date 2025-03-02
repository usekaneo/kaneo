import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/cn";
import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import type { ControllerRenderProps } from "react-hook-form";
import type { z } from "zod";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import type { taskInfoSchema } from "./task-info";

type SelectSingleEventHandler = (date: Date | undefined) => void;

function TaskCalendar({
  field,
  onChange,
}: {
  field: ControllerRenderProps<z.infer<typeof taskInfoSchema>, "dueDate">;
  onChange: SelectSingleEventHandler;
}) {
  const { value } = field;

  return (
    <div className="w-full">
      <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-300 mb-2">
        Due Date
      </h3>
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "w-full flex items-center justify-between rounded-md border px-3 py-2 text-sm",
              "bg-white dark:bg-zinc-800/50",
              "border-zinc-200 dark:border-zinc-700/50",
              "text-zinc-900 dark:text-zinc-100",
              "focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400",
              "hover:border-zinc-300 dark:hover:border-zinc-600",
            )}
          >
            <span>
              {value ? (
                format(new Date(value), "PPP")
              ) : (
                <span className="text-zinc-500 dark:text-zinc-400">
                  Pick a date
                </span>
              )}
            </span>
            <CalendarIcon className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="w-auto p-0 bg-zinc-100 dark:bg-zinc-800 border-none"
          align="start"
        >
          <Calendar
            mode="single"
            selected={value ? new Date(value) : undefined}
            onSelect={onChange}
            className="w-auto border-none"
            initialFocus
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

export default TaskCalendar;
