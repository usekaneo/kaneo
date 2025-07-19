import { CheckCircle, Circle, Clock, Eye } from "lucide-react";

export const getColumnIcon = (columnId: string) => {
  switch (columnId) {
    case "to-do":
      return Circle;
    case "in-progress":
      return Clock;
    case "in-review":
      return Eye;
    case "done":
      return CheckCircle;
    default:
      return Circle;
  }
};

export const getColumnIconColor = (columnId: string) => {
  switch (columnId) {
    case "to-do":
      return "text-zinc-400 dark:text-zinc-500";
    case "in-progress":
      return "text-yellow-500 dark:text-yellow-400";
    case "in-review":
      return "text-blue-500 dark:text-blue-400";
    case "done":
      return "text-green-500 dark:text-green-400";
    default:
      return "text-zinc-400 dark:text-zinc-500";
  }
};
