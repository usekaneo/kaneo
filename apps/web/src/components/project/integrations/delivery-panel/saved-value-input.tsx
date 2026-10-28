import { CheckIcon } from "lucide-react";
import type { ComponentProps } from "react";
import { FormControl, useFormField } from "@/components/ui/form";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";

type SavedValueInputProps = Omit<
  ComponentProps<typeof InputGroupInput>,
  "className"
> & {
  saved: boolean;
  className?: string;
};

export function SavedValueInput({
  saved,
  className,
  ...props
}: SavedValueInputProps) {
  const { error } = useFormField();

  return (
    <InputGroup className={className}>
      {saved ? (
        <InputGroupAddon>
          <CheckIcon
            aria-hidden="true"
            className="size-3.5 text-success-foreground"
          />
        </InputGroupAddon>
      ) : null}
      <FormControl>
        <InputGroupInput {...props} aria-invalid={error ? true : undefined} />
      </FormControl>
    </InputGroup>
  );
}
