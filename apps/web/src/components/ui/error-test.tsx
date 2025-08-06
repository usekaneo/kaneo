import { ErrorDisplay } from "./error-display";

export function ErrorTest() {
  const testError = new Error(
    "Failed to connect to API server at https://api.andrej.com. This might be due to CORS configuration issues or the server not running. Please check your environment variables and server status.",
  );

  return (
    <div className="p-4">
      <h2 className="text-lg font-semibold mb-4">Error Handling Test</h2>
      <ErrorDisplay
        error={testError}
        title="Test Error"
        className="min-h-[300px]"
      />
    </div>
  );
}
