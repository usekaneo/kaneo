import type Task from "@/types/task";
import { AssigneeAvatar } from "./properties/assignee-avatar";

type AssigneeAvatarsProps = {
  task: Pick<Task, "userId" | "assignees">;
  name?: string | null;
  image?: string | null;
  className?: string;
  fallbackClassName?: string;
};
export function AssigneeAvatars({
  task,
  name,
  image,
  className,
  fallbackClassName,
}: AssigneeAvatarsProps) {
  const people =
    task.assignees ??
    (task.userId
      ? [{ id: task.userId, name: name ?? "", image: image ?? null }]
      : []);
  if (!people.length)
    return (
      <AssigneeAvatar
        name={null}
        image={null}
        assigned={false}
        className={className}
      />
    );
  return (
    <span
      aria-hidden="true"
      className="inline-flex items-center -space-x-1"
      title={people.map((person) => person.name).join(", ")}
    >
      {people.slice(0, 3).map((person) => (
        <AssigneeAvatar
          key={person.id}
          name={person.name}
          image={person.image}
          assigned
          className={className}
          fallbackClassName={fallbackClassName}
        />
      ))}
      {people.length > 3 && (
        <span className="rounded-full bg-muted px-1 text-[10px] text-muted-foreground">
          +{people.length - 3}
        </span>
      )}
    </span>
  );
}
