export default function CalendarSubtasks({
  subtasks,
}: {
  subtasks?: readonly { id: string; title: string }[];
}) {
  if (!subtasks?.length) return null;

  return (
    <span className="flex w-full min-w-0 flex-col gap-1 border-t border-current/15 pt-1 text-xs font-normal">
      {subtasks.map((task) => (
        <span key={task.id} className="truncate pl-2" title={task.title}>
          {task.title}
        </span>
      ))}
    </span>
  );
}
