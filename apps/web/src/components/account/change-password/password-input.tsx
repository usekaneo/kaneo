import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import type { ControllerRenderProps, FieldValues, Path } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Input, type InputProps } from "@/components/ui/input";

type PasswordInputProps<T extends FieldValues> = {
  field: ControllerRenderProps<T, Path<T>>;
} & Omit<InputProps, "type">;

export function PasswordInput<T extends FieldValues>({
  field,
  ...inputProps
}: PasswordInputProps<T>) {
  const { t } = useTranslation();
  const [show, setShow] = useState(false);

  return (
    <div className="relative">
      <Input
        type={show ? "text" : "password"}
        className="[&_input]:pe-9"
        {...inputProps}
        {...field}
      />
      <button
        type="button"
        onClick={() => setShow((prev) => !prev)}
        className="touch-hitbox absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        aria-label={
          show ? t("auth:forms.hidePassword") : t("auth:forms.showPassword")
        }
        aria-pressed={show}
      >
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}
