import { CheckCircle2, Clock } from "lucide-react";

export function getStatusIcon(status: "active" | "pending") {
  switch (status) {
    case "active":
      return (
        <CheckCircle2 className="w-4 h-4 text-green-500 dark:text-green-400" />
      );
    case "pending":
      return <Clock className="w-4 h-4 text-yellow-500 dark:text-yellow-400" />;
  }
}

export function getStatusText(status: "active" | "pending") {
  switch (status) {
    case "active":
      return "Active";
    case "pending":
      return "Pending";
  }
}
