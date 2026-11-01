import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ModelCatalogPicker } from "./model-catalog-picker";
import type { AdminAgentSettings, ModelChoice } from "./types";

type AddModelFormProps = {
  providers: AdminAgentSettings["providers"];
  selectedIds: string[];
  pending: boolean;
  onAdd: (model: ModelChoice) => void;
  onClose: () => void;
};

export function AddModelForm({
  providers,
  selectedIds,
  pending,
  onAdd,
  onClose,
}: AddModelFormProps) {
  const { t } = useTranslation();
  const providerId = useId();
  const [provider, setProvider] = useState(providers[0]?.id ?? "");
  const [choice, setChoice] = useState<ModelChoice | null>(null);

  return (
    <form
      className="contents"
      onSubmit={(event) => {
        event.preventDefault();
        if (choice) onAdd(choice);
      }}
    >
      <DialogHeader>
        <DialogTitle>{t("settings:adminAgent.add")}</DialogTitle>
        <DialogDescription>
          {t("settings:adminAgent.addDescription")}
        </DialogDescription>
      </DialogHeader>
      <DialogPanel className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor={providerId}>
            {t("settings:adminAgent.provider")}
          </Label>
          <Select
            items={Object.fromEntries(
              providers.map((item) => [item.id, item.label]),
            )}
            value={provider}
            onValueChange={(value) => {
              if (!value) return;
              setProvider(value);
              setChoice(null);
            }}
          >
            <SelectTrigger id={providerId} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectPopup>
              {providers.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectPopup>
          </Select>
        </div>
        <ModelCatalogPicker
          key={provider}
          provider={provider}
          selectedIds={selectedIds}
          onChange={setChoice}
        />
      </DialogPanel>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          {t("common:actions.cancel")}
        </Button>
        <Button type="submit" disabled={!choice || pending}>
          {pending
            ? t("settings:adminAgent.adding")
            : t("settings:adminAgent.add")}
        </Button>
      </DialogFooter>
    </form>
  );
}
