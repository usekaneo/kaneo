import { useTranslation } from "react-i18next";
import { CustomFieldTypeIcon } from "@/components/custom-fields/custom-field-type-icon";
import type { CustomFieldDefinition } from "@/components/project/custom-fields/types";
import { Toggle } from "@/components/ui/toggle";
import useGetCustomFieldsByProject from "@/hooks/queries/custom-field/use-get-custom-fields-by-project";
import { useUserPreferencesStore } from "@/store/user-preferences";

export function CustomFieldToggles({ projectId }: { projectId: string }) {
  const { t } = useTranslation();
  const { data: fields = [] } = useGetCustomFieldsByProject(projectId) as {
    data: CustomFieldDefinition[] | undefined;
  };
  const hiddenFieldIds = useUserPreferencesStore(
    (state) => state.hiddenCardFieldIds,
  );
  const toggleCardFieldHidden = useUserPreferencesStore(
    (state) => state.toggleCardFieldHidden,
  );

  if (fields.length === 0) return null;

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-muted-foreground text-xs">
        {t("tasks:customFields.fields")}
      </span>
      <div className="flex flex-wrap gap-1.5">
        {fields.map((field) => (
          <Toggle
            key={field.id}
            variant="outline"
            size="sm"
            pressed={!hiddenFieldIds.includes(field.id)}
            onPressedChange={() => toggleCardFieldHidden(field.id)}
            className="gap-1.5 px-2.5 text-muted-foreground text-xs data-pressed:text-foreground"
          >
            <CustomFieldTypeIcon type={field.type} className="size-3.5" />
            {field.name}
          </Toggle>
        ))}
      </div>
    </div>
  );
}
