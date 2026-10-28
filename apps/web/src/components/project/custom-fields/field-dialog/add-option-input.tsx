import { Plus } from "lucide-react";
import { type KeyboardEvent, useState } from "react";
import { useTranslation } from "react-i18next";

type AddOptionInputProps = {
  onAdd: (option: string) => void;
};

export function AddOptionInput({ onAdd }: AddOptionInputProps) {
  const { t } = useTranslation();
  const [value, setValue] = useState("");

  const add = () => {
    if (!value.trim()) return;
    onAdd(value);
    setValue("");
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    add();
  };

  return (
    <div className="flex h-9 items-center gap-2.5 px-2.5">
      <Plus
        aria-hidden="true"
        className="size-3.5 shrink-0 text-muted-foreground"
      />
      <input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={add}
        placeholder={t("settings:customFields.addOption")}
        aria-label={t("settings:customFields.addOption")}
        className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
      />
    </div>
  );
}
