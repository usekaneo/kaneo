import { Check, Circle, CircleDot, Search } from "lucide-react";

export const DEFAULT_COLUMNS = [
  { id: "to-do", name: "To Do", icon: Circle },
  { id: "in-progress", name: "In Progress", icon: CircleDot },
  { id: "in-review", name: "In Review", icon: Search },
  { id: "done", name: "Done", icon: Check },
] as const;
