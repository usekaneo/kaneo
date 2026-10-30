import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import type { SortConfig } from "@/lib/sort-tasks";
import { useUserPreferencesStore } from "@/store/user-preferences";
import { CardFieldToggles } from "./card-field-toggles";
import { CustomFieldToggles } from "./custom-field-toggles";
import { DisplaySection } from "./display-section";
import { ProjectBackgroundSwitch } from "./project-background-switch";
import { MANUAL_SORT } from "./sort-fields";
import { SortOrderControl } from "./sort-order-control";

type TaskDisplayOptionsProps = {
  projectId: string;
  sort: SortConfig;
  onSortChange: (sort: SortConfig) => void;
  layout: "cards" | "rows";
  showBackgroundSwitch?: boolean;
};

export function TaskDisplayOptions({
  projectId,
  sort,
  onSortChange,
  layout,
  showBackgroundSwitch = false,
}: TaskDisplayOptionsProps) {
  const { t } = useTranslation();
  const resetDisplayPreferences = useUserPreferencesStore(
    (state) => state.resetDisplayPreferences,
  );

  return (
    <>
      <DisplaySection>
        <SortOrderControl sort={sort} onSortChange={onSortChange} />
      </DisplaySection>
      <DisplaySection
        title={
          layout === "cards"
            ? t("tasks:display.showOnCards")
            : t("tasks:display.showOnRows")
        }
      >
        <div className="flex flex-col gap-3">
          <CardFieldToggles />
          <CustomFieldToggles projectId={projectId} />
        </div>
      </DisplaySection>
      {showBackgroundSwitch && (
        <DisplaySection>
          <ProjectBackgroundSwitch />
        </DisplaySection>
      )}
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
