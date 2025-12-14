import { ErrorDisplay } from "./error-display";

type ErrorFallbackProps = {
  error: Error;
  resetError: () => void;
};

export function ErrorFallback({ error, resetError }: ErrorFallbackProps) {
  return (
    <ErrorDisplay
      error={error}
      onRetry={resetError}
      title="Something went wrong"
      className="min-h-screen"
    />
  );
}
