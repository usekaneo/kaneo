import { useQuery } from "@tanstack/react-query";
import { Bookmark, Pencil, Plus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  getPersonalViews,
  type PersonalView,
  type ProjectViewConfig,
} from "@/fetchers/saved-view";
import { PersonalViewEditor } from "./personal-view-editor";

type Props = {
  projectId: string;
  config: () => ProjectViewConfig;
  onApply: (config: ProjectViewConfig) => void;
};
export function PersonalViews({ projectId, config, onApply }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PersonalView | "new" | null>(null);
  const query = useQuery({
    queryKey: ["personal-views", projectId],
    queryFn: () => getPersonalViews(projectId),
    enabled: open || editing !== null,
    refetchOnWindowFocus: "always",
    refetchOnMount: "always",
  });
  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t("tasks:personalViews.title")}
            />
          }
        >
          <Bookmark />
        </PopoverTrigger>
        <PopoverContent align="end" className="w-72">
          <PopoverTitle>{t("tasks:personalViews.title")}</PopoverTitle>
          <p className="mb-2 text-muted-foreground text-xs">
            {t("tasks:personalViews.private")}
          </p>
          {query.isPending && <p role="status">{t("common:empty.loading")}</p>}
          {query.isError && (
            <p role="alert" className="text-sm">
              {t("tasks:personalViews.error")}{" "}
              <Button variant="link" onClick={() => void query.refetch()}>
                {t("tasks:descriptionRetry")}
              </Button>
            </p>
          )}
          <div className="max-h-64 overflow-y-auto">
            {query.data?.map((view) => (
              <div key={view.id} className="flex items-center">
                <Button
                  variant="ghost"
                  className="min-w-0 flex-1 justify-start truncate"
                  onClick={() => {
                    onApply(view.config);
                    setOpen(false);
                  }}
                >
                  {view.name}
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t("tasks:personalViews.edit", {
                    name: view.name,
                  })}
                  onClick={() => {
                    setEditing(view);
                    setOpen(false);
                  }}
                >
                  <Pencil />
                </Button>
              </div>
            ))}
            {query.data?.length === 0 && (
              <p className="py-2 text-muted-foreground text-sm">
                {t("tasks:personalViews.empty")}
              </p>
            )}
          </div>
          <Button
            variant="ghost"
            className="mt-2 w-full justify-start"
            onClick={() => {
              setEditing("new");
              setOpen(false);
            }}
          >
            <Plus />
            {t("tasks:personalViews.save")}
          </Button>
        </PopoverContent>
      </Popover>
      {editing && (
        <PersonalViewEditor
          key={editing === "new" ? "new" : editing.id}
          projectId={projectId}
          view={editing === "new" ? undefined : editing}
          config={config()}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}
