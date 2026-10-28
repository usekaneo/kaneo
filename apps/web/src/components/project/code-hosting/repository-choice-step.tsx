import { type ReactNode, useId } from "react";
import { RepositoryPathInput } from "@/components/project/code-hosting/repository-path-input";
import { IntegrationStep } from "@/components/project/integrations/panel/integration-step";

type RepositoryChoiceStepProps = {
  title: string;
  description: string;
  inputLabel: string;
  placeholder: string;
  value: string;
  invalidMessage: string | null;
  disabled: boolean;
  browseDisabled: boolean;
  status: ReactNode;
  onChange: (value: string) => void;
  onBlur: () => void;
  onBrowse: () => void;
};

export function RepositoryChoiceStep({
  title,
  description,
  inputLabel,
  placeholder,
  value,
  invalidMessage,
  disabled,
  browseDisabled,
  status,
  onChange,
  onBlur,
  onBrowse,
}: RepositoryChoiceStepProps) {
  const id = useId();

  return (
    <IntegrationStep number={2} last title={title} description={description}>
      <RepositoryPathInput
        id={id}
        label={inputLabel}
        value={value}
        placeholder={placeholder}
        invalid={invalidMessage !== null}
        disabled={disabled}
        browseDisabled={browseDisabled}
        onChange={onChange}
        onBlur={onBlur}
        onBrowse={onBrowse}
      />
      {invalidMessage ? (
        <p id={`${id}-error`} className="text-xs text-destructive-foreground">
          {invalidMessage}
        </p>
      ) : (
        status
      )}
    </IntegrationStep>
  );
}
