import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

export type MyTasksGroupBy = "dueDate" | "project";

type MyTasksGroupByProps = {
  value: MyTasksGroupBy;
  onChange: (value: MyTasksGroupBy) => void;
};

export function MyTasksGroupByToggle({ value, onChange }: MyTasksGroupByProps) {
  const { t } = useTranslation();
  const options: Array<{ value: MyTasksGroupBy; label: string }> = [
    { value: "dueDate", label: t("workspace:myTasks.groupBy.dueDate") },
    { value: "project", label: t("workspace:myTasks.groupBy.project") },
  ];

  return (
    <fieldset className="inline-flex items-center gap-0.5">
      <legend className="sr-only">
        {t("workspace:myTasks.groupBy.label")}
      </legend>
      {options.map((option) => (
        <Button
          key={option.value}
          variant={value === option.value ? "secondary" : "ghost"}
          size="xs"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(value !== option.value && "text-muted-foreground")}
        >
          {option.label}
        </Button>
      ))}
    </fieldset>
  );
}
