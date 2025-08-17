import useGetGiteaIntegration from "../../hooks/queries/gitea-integration/use-get-gitea-integration";

interface WebhookInfoProps {
  projectId: string;
}

export function GiteaWebhookInfo({ projectId }: WebhookInfoProps) {
  const { data: integration, isLoading } = useGetGiteaIntegration(projectId);

  if (isLoading || !integration) {
    return null;
  }

  // Use VITE_API_URL environment variable if available, otherwise fallback to current origin
  const apiBaseUrl =
    import.meta.env.VITE_API_URL ||
    window.location.origin.replace(/:\d+$/, ":1337");
  const isDevelopment =
    apiBaseUrl.includes("localhost") || apiBaseUrl.includes("127.0.0.1");

  const webhookUrl = `${apiBaseUrl}/gitea-integration/webhook`;
  const giteaWebhookUrl = `${integration.giteaUrl}/${integration.repositoryOwner}/${integration.repositoryName}/settings/hooks/gitea/new`;

  return (
    <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
      <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-3">
        🔄 Bidirectional Sync Setup
      </h3>

      <div className="space-y-3 text-sm">
        <div>
          <p className="text-blue-800 dark:text-blue-200 mb-2">
            To enable bidirectional synchronization (Gitea → Kaneo), configure a
            webhook in your Gitea repository:
          </p>

          <div className="bg-white dark:bg-gray-800 p-3 rounded border">
            <p className="font-mono text-xs text-gray-600 dark:text-gray-400 mb-2">
              Webhook URL:
              {isDevelopment && (
                <span className="ml-2 px-2 py-1 bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 rounded text-xs">
                  DEV: {apiBaseUrl}
                </span>
              )}
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                {webhookUrl}
              </code>
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(webhookUrl)}
                className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-200 rounded hover:bg-blue-200 dark:hover:bg-blue-700"
              >
                Copy
              </button>
            </div>
            {isDevelopment && (
              <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-2">
                ⚠️ Using API URL from KANEO_API_URL: {apiBaseUrl}
              </p>
            )}
          </div>
        </div>

        <div>
          <p className="text-blue-800 dark:text-blue-200 mb-2">
            Webhook Configuration:
          </p>
          <ul className="list-disc list-inside text-blue-700 dark:text-blue-300 space-y-1 ml-4">
            <li>
              Content Type:{" "}
              <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">
                application/json
              </code>
            </li>
            <li>
              Events: <strong>Issues</strong> (create, update, delete, close)
            </li>
            <li>Active: ✅ Enabled</li>
            {integration.webhookSecret &&
              integration.webhookSecret.length >= 32 && (
                <li>
                  Secret:{" "}
                  <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded text-xs">
                    {integration.webhookSecret.substring(0, 8)}...
                  </code>{" "}
                  (configured ✅)
                </li>
              )}
            {integration.webhookSecret &&
              integration.webhookSecret.length < 32 && (
                <li className="text-red-600 dark:text-red-400">
                  ❌ Secret: Too short (must be at least 32 characters)
                </li>
              )}
            {!integration.webhookSecret && (
              <li className="text-red-600 dark:text-red-400">
                ❌ Secret: Not configured (required for webhook security)
              </li>
            )}
          </ul>
        </div>

        <div className="flex items-center justify-between pt-2">
          <a
            href={giteaWebhookUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            <span>🔧</span>
            Setup Webhook in Gitea
          </a>

          <div className="text-xs text-blue-600 dark:text-blue-400">
            <span className="inline-block w-2 h-2 bg-green-500 rounded-full mr-2" />
            Kaneo → Gitea: Active
          </div>
        </div>

        {(!integration.webhookSecret ||
          integration.webhookSecret.length < 32) && (
          <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded">
            <h4 className="text-red-800 dark:text-red-200 font-medium mb-2">
              ⚠️ Security Warning
            </h4>
            <p className="text-sm text-red-700 dark:text-red-300 mb-3">
              Webhooks require a secure secret (minimum 32 characters) to
              prevent unauthorized access. Without a properly configured secret,
              webhooks will be rejected for security.
            </p>
            <p className="text-xs text-red-600 dark:text-red-400">
              Please configure a webhook secret in the integration settings
              above.
            </p>
          </div>
        )}

        {integration.webhookSecret &&
          integration.webhookSecret.length >= 32 && (
            <div className="space-y-4">
              <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded">
                <h4 className="text-amber-800 dark:text-amber-200 font-medium mb-2">
                  Current Sync Features & Debug
                </h4>
                <ul className="text-xs text-amber-700 dark:text-amber-300 space-y-1">
                  <li>• Issue created → Creates new task in Kaneo</li>
                  <li>• Issue updated → Updates task title/description</li>
                  <li>
                    • Issue closed/reopened → Updates task status (done/to-do)
                  </li>
                  <li>• Issue deleted → Deletes corresponding task</li>
                  <li>
                    • Comments, labels, and assignees are not synced yet (coming
                    soon)
                  </li>
                </ul>

                <div className="mt-3 p-2 bg-gray-100 dark:bg-gray-800 rounded text-xs">
                  <p className="text-gray-600 dark:text-gray-400 mb-1">
                    Debug: Webhook logs appear in server console
                  </p>
                  <p className="text-gray-500 dark:text-gray-500">
                    Look for "=== GITEA WEBHOOK DEBUG ===" in your terminal
                  </p>
                </div>
              </div>

              <div className="p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded">
                <h4 className="text-orange-800 dark:text-orange-200 font-medium mb-2">
                  🔧 Gitea Server Configuration Required
                </h4>
                <p className="text-sm text-orange-700 dark:text-orange-300 mb-3">
                  For webhooks to work with localhost/development URLs, you need
                  to configure Gitea to allow local connections:
                </p>

                <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded border mb-3">
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                    Add to your Gitea app.ini config:
                  </p>
                  <code className="block text-xs font-mono bg-gray-200 dark:bg-gray-700 p-2 rounded">
                    [webhook]
                    <br />
                    ALLOWED_HOST_LIST = localhost,127.0.0.1,::1,*.local
                  </code>
                </div>

                <div className="text-xs text-orange-600 dark:text-orange-400 space-y-1">
                  <p>
                    • <strong>Development:</strong> Allow localhost for testing
                  </p>
                  <p>
                    • <strong>Production:</strong> Replace with your actual
                    domain
                  </p>
                  <p>
                    • <strong>Error example:</strong> "webhook can only call
                    allowed HTTP servers"
                  </p>
                  <p>
                    • <strong>Connection refused:</strong> Check API is running
                    on port 1337
                  </p>
                </div>
              </div>

              <div className="p-3 bg-gray-50 dark:bg-gray-900/20 border border-gray-200 dark:border-gray-800 rounded">
                <h4 className="text-gray-800 dark:text-gray-200 font-medium mb-2">
                  🔍 Technical Details
                </h4>
                <div className="text-xs text-gray-600 dark:text-gray-400 space-y-2">
                  <div>
                    <p className="font-semibold mb-1">Expected Headers:</p>
                    <ul className="list-disc list-inside ml-2 space-y-1">
                      <li>
                        <code>X-Gitea-Event: issues</code>
                      </li>
                      <li>
                        <code>X-Gitea-Signature: sha256=...</code>
                      </li>
                      <li>
                        <code>Content-Type: application/json</code>
                      </li>
                    </ul>
                  </div>
                  <div>
                    <p className="font-semibold mb-1">Supported Actions:</p>
                    <ul className="list-disc list-inside ml-2 space-y-1">
                      <li>
                        <code>opened</code> - Creates new task
                      </li>
                      <li>
                        <code>edited</code> - Updates task title/description
                      </li>
                      <li>
                        <code>closed</code> - Sets task status to "done"
                      </li>
                      <li>
                        <code>reopened</code> - Sets task status to "to-do"
                      </li>
                      <li>
                        <code>deleted</code> - Removes task
                      </li>
                    </ul>
                  </div>
                  <div>
                    <p className="font-semibold mb-1">Gitea Compatibility:</p>
                    <ul className="list-disc list-inside ml-2 space-y-1">
                      <li>✅ Gitea v1.17+ webhook format</li>
                      <li>✅ SHA256 signature verification</li>
                      <li>✅ Issue state mapping</li>
                    </ul>
                  </div>
                  <div>
                    <p className="font-semibold mb-1">Troubleshooting:</p>
                    <ul className="list-disc list-inside ml-2 space-y-1">
                      <li>
                        ✅ <strong>API Running:</strong> Check localhost:1337 is
                        accessible
                      </li>
                      <li>
                        ⚠️ <strong>Wrong Port:</strong> Don't use frontend port
                        (5173)
                      </li>
                      <li>
                        🔍 <strong>Debug Logs:</strong> "=== GITEA WEBHOOK DEBUG
                        ===" in console
                      </li>
                      <li>
                        🔐 <strong>Secret Match:</strong> Verify 32+ character
                        secret
                      </li>
                      <li>
                        🌐 <strong>Host Config:</strong> Gitea ALLOWED_HOST_LIST
                        setting
                      </li>
                      <li>
                        📡 <strong>Connection:</strong> Test webhook URL
                        manually
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}
      </div>
    </div>
  );
}
