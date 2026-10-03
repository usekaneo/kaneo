import { format } from "date-fns";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ProjectWithTasks } from "@/types/project";
import messages from "../../../../../i18n/en-US.json";
import { ActivityFeed } from "./activity-feed";
import { AssignedTaskRow } from "./assigned-task-row";
import type { AssignedTask } from "./assigned-tasks";
import { pluralMessage } from "./fill-message";
import { HomeProjects } from "./home-projects";
import { MOCK_ACTIVITY } from "./mock-activity";
import { PreviewPageHeader } from "./page-header";
import { SectionHeader } from "./section-header";
import { WeekStrip } from "./week-strip";

const copy = messages.workspace.home;

function greeting(date = new Date()) {
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) return copy.greeting.morning;
  if (hour >= 12 && hour < 18) return copy.greeting.afternoon;
  return copy.greeting.evening;
}

// apps/web's workspace Home: the week, what's next, projects and activity.
export function HomeView({
  projects,
  assignedTasks,
  tasks,
  onTaskClick,
  onProjectSelect,
  onViewAllTasks,
}: {
  projects: ProjectWithTasks[];
  assignedTasks: AssignedTask[];
  tasks: Map<string, AssignedTask>;
  onTaskClick: (task: AssignedTask) => void;
  onProjectSelect: (id: string) => void;
  onViewAllTasks: () => void;
}) {
  return (
    <>
      <PreviewPageHeader title={copy.pageTitle} />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-9 px-10 py-10">
          <header className="flex items-end justify-between gap-4">
            <div className="flex flex-col gap-1.5">
              <p className="text-[13px] font-medium text-muted-foreground">
                {format(new Date(), "EEEE, MMMM d")}
              </p>
              <h1 className="text-3xl font-semibold tracking-tight text-foreground">
                {greeting()}
              </h1>
            </div>
            <Button size="sm">
              <Plus />
              {copy.newTask}
            </Button>
          </header>

          <WeekStrip tasks={assignedTasks} onTaskClick={onTaskClick} />

          <div className="grid grid-cols-[minmax(0,1fr)_20rem] gap-10">
            <div className="flex min-w-0 flex-col gap-9">
              <section>
                <SectionHeader
                  title={copy.upNext.title}
                  detail={pluralMessage(
                    {
                      one: copy.upNext.assigned_one,
                      other: copy.upNext.assigned_other,
                    },
                    assignedTasks.length,
                  )}
                  action={
                    <button
                      type="button"
                      onClick={onViewAllTasks}
                      className="shrink-0 text-[13px] font-medium text-muted-foreground hover:text-foreground"
                    >
                      {copy.upNext.viewAll}
                    </button>
                  }
                />
                <div className="flex flex-col">
                  {assignedTasks.slice(0, 5).map((task) => (
                    <AssignedTaskRow
                      key={task.id}
                      task={task}
                      onTaskClick={onTaskClick}
                    />
                  ))}
                </div>
              </section>
              <HomeProjects
                projects={projects}
                onProjectSelect={onProjectSelect}
              />
            </div>
            <ActivityFeed
              activities={MOCK_ACTIVITY}
              tasks={tasks}
              onTaskClick={onTaskClick}
            />
          </div>
        </div>
      </div>
    </>
  );
}
