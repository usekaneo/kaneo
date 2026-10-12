import { CheckingLine } from "@/components/project/code-hosting/checking-line";
import {
  type AccessVerificationResult,
  accessVerificationTone,
} from "@/components/project/code-hosting/access-verification-tone";
import { IntegrationCheckLine } from "@/components/project/integrations/panel/integration-check-line";

type AccessVerificationLineProps = {
  checking: boolean;
  result: AccessVerificationResult | undefined;
  error: unknown;
  fallbackError: string;
};

export function AccessVerificationLine({
  checking,
  result,
  error,
  fallbackError,
}: AccessVerificationLineProps) {
  if (checking) return <CheckingLine />;
  if (error) {
    return (
      <IntegrationCheckLine tone="destructive">
        {error instanceof Error && error.message
          ? error.message
          : fallbackError}
      </IntegrationCheckLine>
    );
  }
  if (!result) return null;

  return (
    <IntegrationCheckLine tone={accessVerificationTone(result)}>
      {result.message}
    </IntegrationCheckLine>
  );
}
