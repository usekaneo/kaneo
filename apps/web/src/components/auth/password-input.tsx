import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import type { InputProps } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";

export function PasswordInput(props: Omit<InputProps, "type">) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);

  return (
    <InputGroup>
      <InputGroupInput
        size="lg"
        type={visible ? "text" : "password"}
        {...props}
      />
      <InputGroupAddon align="inline-end">
        <Button
          variant="ghost"
          size="icon-xs"
          className="text-muted-foreground hover:text-foreground"
          aria-label={
            visible
              ? t("auth:forms.hidePassword")
              : t("auth:forms.showPassword")
          }
          aria-pressed={visible}
          onClick={() => setVisible((value) => !value)}
        >
          {visible ? <EyeOff /> : <Eye />}
        </Button>
      </InputGroupAddon>
    </InputGroup>
  );
}
