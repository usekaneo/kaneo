import { useTranslation } from "react-i18next";
import { CardFieldToggles } from "@/components/project/display/card-field-toggles";
import { DisplaySection } from "@/components/project/display/display-section";
import { MANUAL_SORT } from "@/components/project/display/sort-fields";
import { SortOrderControl } from "@/components/project/display/sort-order-control";
import { LayoutSwitch } from "@/components/project/views/layout-switch";
import { PROJECT_VIEWS } from "@/components/project/views/project-views";
import { Button } from "@/components/ui/button";
import type { SortConfig } from "@/lib/sort-tasks";
import { useUserPreferencesStore } from "@/store/user-preferences";

// Calendar and gantt are project-scoped; the workspace view is board or list.
const WORKSPACE_LAYOUTS = PROJECT_VIEWS.filter(
  (view) => view.id === "board" || view.id === "list",
);

type WorkspaceDisplayOptionsProps = {
  sort: SortConfig;
  onSortChange: (sort: SortConfig) => void;
};

export function WorkspaceDisplayOptions({
  sort,
  onSortChange,
}: WorkspaceDisplayOptionsProps) {
  const { t } = useTranslation();
  const viewMode = useUserPreferencesStore((state) => state.viewMode);
  const setViewMode = useUserPreferencesStore((state) => state.setViewMode);
  const resetDisplayPreferences = useUserPreferencesStore(
    (state) => state.resetDisplayPreferences,
  );

  return (
    <>
      <DisplaySection>
        <LayoutSwitch
          layouts={WORKSPACE_LAYOUTS}
          currentView={viewMode}
          onSelect={(view) => {
            if (view === "board" || view === "list") setViewMode(view);
          }}
        />
      </DisplaySection>
      <DisplaySection>
        <SortOrderControl sort={sort} onSortChange={onSortChange} />
      </DisplaySection>
      <DisplaySection
        title={
          viewMode === "board"
            ? t("tasks:display.showOnCards")
            : t("tasks:display.showOnRows")
        }
      >
        <CardFieldToggles />
      </DisplaySection>
      <div className="flex justify-end px-2 py-1.5">
        <Button
          variant="ghost"
          size="xs"
          onClick={() => {
            resetDisplayPreferences();
            onSortChange(MANUAL_SORT);
          }}
        >
          {t("common:actions.reset")}
        </Button>
      </div>
    </>
  );
}
