import { AlertCircle, CheckCircle2, Circle, Clock } from "lucide-react";

export const DEFAULT_COLUMNS = [
  { id: "to-do", name: "To Do", icon: Circle },
  { id: "in-progress", name: "In Progress", icon: Clock },
  { id: "in-review", name: "In Review", icon: AlertCircle },
  { id: "done", name: "Done", icon: CheckCircle2 },
] as const;
