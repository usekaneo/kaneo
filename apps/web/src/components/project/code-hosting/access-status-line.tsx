import { CheckingLine } from "@/components/project/code-hosting/checking-line";
import {
  type AccessVerificationResult,
  accessVerificationTone,
} from "@/components/project/code-hosting/access-verification-tone";
import { StatusDotLine } from "@/components/project/code-hosting/status-dot-line";

type AccessStatusLineProps = {
  checking: boolean;
  result: AccessVerificationResult | undefined;
  error: unknown;
  fallbackError: string;
};

export function AccessStatusLine({
  checking,
  result,
  error,
  fallbackError,
}: AccessStatusLineProps) {
  if (checking) return <CheckingLine />;
  if (error) {
    return (
      <StatusDotLine tone="destructive">
        {error instanceof Error && error.message
          ? error.message
          : fallbackError}
      </StatusDotLine>
    );
  }
  if (!result) return null;

  return (
    <StatusDotLine tone={accessVerificationTone(result)}>
      {result.message}
    </StatusDotLine>
  );
}
