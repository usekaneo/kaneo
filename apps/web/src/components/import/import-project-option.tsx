import { Checkbox } from "@/components/ui/checkbox";
import type { ImportSourceProject } from "@/fetchers/import/list-import-source-projects";

type ImportProjectOptionProps = {
  project: ImportSourceProject;
};

export function ImportProjectOption({ project }: ImportProjectOptionProps) {
  return (
    <label className="flex cursor-pointer items-center gap-3 px-4 py-3.5 transition-colors hover:bg-accent/40">
      <Checkbox value={project.id} />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium text-sm">
          {project.name}
        </span>
        {project.detail ? (
          <span className="block truncate text-muted-foreground text-xs">
            {project.detail}
          </span>
        ) : null}
      </span>
    </label>
  );
}
