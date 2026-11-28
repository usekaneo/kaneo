type GanttMessageProps = {
  title: string;
  description: string;
};

export function GanttMessage({ title, description }: GanttMessageProps) {
  return (
    <div className="gantt:flex gantt:flex-1 gantt:items-center gantt:justify-center gantt:px-6">
      <div className="gantt:max-w-sm gantt:text-center">
        <h2 className="gantt:text-sm gantt:font-semibold gantt:text-foreground">
          {title}
        </h2>
        <p className="gantt:mt-1 gantt:text-sm gantt:text-muted-foreground">
          {description}
        </p>
      </div>
    </div>
  );
}
