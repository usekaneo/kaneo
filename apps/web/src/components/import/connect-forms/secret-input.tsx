import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { fieldDescribedBy } from "@/components/import/connect-forms/field-ids";
import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";

type SecretInputProps = {
  id: string;
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  invalid?: boolean;
};

export function SecretInput({
  id,
  label,
  value,
  onValueChange,
  placeholder,
  invalid = false,
}: SecretInputProps) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);

  return (
    <InputGroup>
      <InputGroupInput
        id={id}
        type={visible ? "text" : "password"}
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        placeholder={placeholder}
        aria-invalid={invalid || undefined}
        aria-describedby={fieldDescribedBy(id, invalid)}
      />
      <InputGroupAddon align="inline-end">
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={
            visible
              ? t("settings:workspaceImport.connect.hideSecret", {
                  field: label,
                })
              : t("settings:workspaceImport.connect.showSecret", {
                  field: label,
                })
          }
          aria-pressed={visible}
          onClick={() => setVisible((current) => !current)}
        >
          {visible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
        </Button>
      </InputGroupAddon>
    </InputGroup>
  );
}
