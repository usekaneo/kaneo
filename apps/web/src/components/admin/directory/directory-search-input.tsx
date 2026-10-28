import { SearchIcon } from "lucide-react";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";

type DirectorySearchInputProps = {
  value: string;
  onValueChange: (value: string) => void;
  placeholder: string;
  label: string;
  maxLength: number;
};

export function DirectorySearchInput({
  value,
  onValueChange,
  placeholder,
  label,
  maxLength,
}: DirectorySearchInputProps) {
  return (
    <InputGroup className="w-full sm:w-60">
      <InputGroupInput
        size="sm"
        type="search"
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        maxLength={maxLength}
        placeholder={placeholder}
        aria-label={label}
      />
      <InputGroupAddon align="inline-start">
        <SearchIcon aria-hidden="true" />
      </InputGroupAddon>
    </InputGroup>
  );
}
