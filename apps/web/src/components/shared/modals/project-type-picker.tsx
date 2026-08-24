import { useTranslation } from "react-i18next";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DEFAULT_PROJECT_TYPE,
  PROJECT_TYPE_KEYS,
  type ProjectTypeKey,
} from "@/constants/project-types";

type ProjectTypePickerProps = {
  value: ProjectTypeKey;
  onChange: (value: ProjectTypeKey) => void;
};

function ProjectTypePicker({ value, onChange }: ProjectTypePickerProps) {
  const { t } = useTranslation();
  const selectedLabel = t(`common:projectTypes.${value}`);

  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium text-muted-foreground">
        {t("common:modals.createProject.typeLabel")}
      </Label>
      <Select
        value={value}
        onValueChange={(next) => {
          if (next && PROJECT_TYPE_KEYS.includes(next as ProjectTypeKey)) {
            onChange(next as ProjectTypeKey);
          }
        }}
      >
        <SelectTrigger size="sm" className="w-full">
          <SelectValue>
            {selectedLabel || t(`common:projectTypes.${DEFAULT_PROJECT_TYPE}`)}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {PROJECT_TYPE_KEYS.map((key) => (
            <SelectItem key={key} value={key}>
              {t(`common:projectTypes.${key}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export default ProjectTypePicker;
