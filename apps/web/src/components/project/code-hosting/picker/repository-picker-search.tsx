import { SearchIcon } from "lucide-react";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";

type RepositoryPickerSearchProps = {
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
};

export function RepositoryPickerSearch({
  value,
  placeholder,
  onChange,
}: RepositoryPickerSearchProps) {
  return (
    <InputGroup>
      <InputGroupAddon>
        <SearchIcon aria-hidden="true" />
      </InputGroupAddon>
      <InputGroupInput
        type="search"
        aria-label={placeholder}
        placeholder={placeholder}
        value={value}
        maxLength={100}
        autoComplete="off"
        onChange={(event) => onChange(event.target.value)}
      />
    </InputGroup>
  );
}
