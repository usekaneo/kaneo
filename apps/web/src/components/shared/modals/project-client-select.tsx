import { useTranslation } from "react-i18next";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import useEnsureDefaultClient from "@/hooks/queries/client/use-ensure-default-client";
import useGetClients from "@/hooks/queries/client/use-get-clients";

const NONE_VALUE = "__none__";

type ProjectClientSelectProps = {
  workspaceId: string;
  value: string | null;
  onChange: (clientId: string | null) => void;
};

function ProjectClientSelect({
  workspaceId,
  value,
  onChange,
}: ProjectClientSelectProps) {
  const { t } = useTranslation();
  useEnsureDefaultClient(workspaceId);
  const { data: clients } = useGetClients({ workspaceId });
  const selected = clients?.find((item) => item.id === value);

  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium text-muted-foreground">
        {t("common:modals.createProject.clientLabel")}
      </Label>
      <Select
        value={value ?? NONE_VALUE}
        onValueChange={(next) => {
          if (!next || next === NONE_VALUE) {
            onChange(null);
            return;
          }
          onChange(next);
        }}
      >
        <SelectTrigger size="sm" className="w-full">
          <SelectValue
            placeholder={t("common:modals.createProject.clientPlaceholder")}
          >
            {selected?.name ??
              t("common:modals.createProject.clientPlaceholder")}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE_VALUE}>
            {t("common:modals.createProject.clientPlaceholder")}
          </SelectItem>
          {(clients ?? []).map((item) => (
            <SelectItem key={item.id} value={item.id}>
              {item.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export default ProjectClientSelect;
