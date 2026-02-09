import { CheckCircle2, Circle, CircleDot, Search } from "lucide-react";

export const getColumnIcon = (columnId: string, isFinal?: boolean) => {
  switch (columnId) {
    case "to-do":
      return <Circle className="w-4 h-4 text-muted-foreground" />;
    case "in-progress":
      return <CircleDot className="w-4 h-4 text-muted-foreground" />;
    case "in-review":
      return <Search className="w-4 h-4 text-muted-foreground" />;
    case "done":
      return <CheckCircle2 className="w-4 h-4 text-muted-foreground" />;
    default:
      return isFinal ? (
        <CheckCircle2 className="w-4 h-4 text-muted-foreground" />
      ) : (
        <Circle className="w-4 h-4 text-muted-foreground" />
      );
  }
};
