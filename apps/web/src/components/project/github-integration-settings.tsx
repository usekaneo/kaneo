import { RepositoryBrowserModal } from "@/components/project/repository-browser-modal";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import type { VerifyGithubInstallationResponse } from "@/fetchers/github-integration/verify-github-installation";
import {
  useCreateGithubIntegration,
  useDeleteGithubIntegration,
  useVerifyGithubInstallation,
} from "@/hooks/mutations/github-integration/use-create-github-integration";
import useGetGithubIntegration from "@/hooks/queries/github-integration/use-get-github-integration";
import { cn } from "@/lib/cn";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import {
  AlertTriangle,
  CheckCircle,
  ExternalLink,
  GitBranch,
  Github,
  Link,
  RefreshCw,
  Unlink,
  XCircle,
} from "lucide-react";
import React from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod/v4";

const githubIntegrationSchema = z.object({
  repositoryOwner: z
    .string()
    .min(1, "Repository owner is required")
    .regex(/^[a-zA-Z0-9-]+$/, "Invalid repository owner format"),
  repositoryName: z
    .string()
    .min(1, "Repository name is required")
    .regex(/^[a-zA-Z0-9._-]+$/, "Invalid repository name format"),
});

type GithubIntegrationFormValues = z.infer<typeof githubIntegrationSchema>;

export function GitHubIntegrationSettings({
  projectId,
}: { projectId: string }) {
  const { data: integration, isLoading } = useGetGithubIntegration(projectId);
  const { mutateAsync: createIntegration, isPending: isCreating } =
    useCreateGithubIntegration();
  const { mutateAsync: deleteIntegration, isPending: isDeleting } =
    useDeleteGithubIntegration();
  const { mutateAsync: verifyInstallation, isPending: isVerifying } =
    useVerifyGithubInstallation();

  const [verificationResult, setVerificationResult] =
    React.useState<VerifyGithubInstallationResponse | null>(null);
  const [showRepositoryBrowser, setShowRepositoryBrowser] =
    React.useState(false);

  const form = useForm<GithubIntegrationFormValues>({
    resolver: standardSchemaResolver(githubIntegrationSchema),
    defaultValues: {
      repositoryOwner: integration?.repositoryOwner || "",
      repositoryName: integration?.repositoryName || "",
    },
  });

  React.useEffect(() => {
    if (integration) {
      form.reset({
        repositoryOwner: integration.repositoryOwner,
        repositoryName: integration.repositoryName,
      });
    }
  }, [integration, form]);

  const repositoryOwner = form.watch("repositoryOwner");
  const repositoryName = form.watch("repositoryName");

  const handleVerifyInstallation = React.useCallback(
    async (data: GithubIntegrationFormValues, showToast = true) => {
      try {
        const result = await verifyInstallation(data);
        setVerificationResult(result);

        if (showToast) {
          if (result.isInstalled && result.hasRequiredPermissions) {
            toast.success("GitHub App is properly installed!");
          } else if (result.isInstalled) {
            toast.warning(
              "GitHub App is installed but missing required permissions",
            );
          } else if (result.repositoryExists) {
            toast.warning(
              "GitHub App needs to be installed on this repository",
            );
          } else {
            toast.error("Repository not found or not accessible");
          }
        }
      } catch (error) {
        if (showToast) {
          toast.error(
            error instanceof Error
              ? error.message
              : "Failed to verify GitHub installation",
          );
        }
        setVerificationResult(null);
      }
    },
    [verifyInstallation],
  );

  React.useEffect(() => {
    if (repositoryOwner && repositoryName && form.formState.isValid) {
      handleVerifyInstallation({ repositoryOwner, repositoryName }, false);
    }
  }, [
    repositoryOwner,
    repositoryName,
    form.formState.isValid,
    handleVerifyInstallation,
  ]);

  const handleRepositorySelect = (repository: {
    owner: string;
    name: string;
  }) => {
    form.setValue("repositoryOwner", repository.owner, {
      shouldValidate: true,
      shouldDirty: true,
      shouldTouch: true,
    });
    form.setValue("repositoryName", repository.name, {
      shouldValidate: true,
      shouldDirty: true,
      shouldTouch: true,
    });
    setShowRepositoryBrowser(false);

    setVerificationResult(null);
  };

  const onSubmit = async (data: GithubIntegrationFormValues) => {
    try {
      const verification = await verifyInstallation(data);

      if (!verification.isInstalled) {
        toast.error("Please install the GitHub App on this repository first");
        return;
      }

      if (!verification.hasRequiredPermissions) {
        toast.error(
          `GitHub App is missing required permissions: ${verification.missingPermissions?.join(", ") || "issues"}. Please update the app permissions.`,
        );
        return;
      }

      await createIntegration({
        projectId,
        data,
      });
      toast.success("GitHub integration updated successfully");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to update GitHub integration",
      );
    }
  };

  const handleDelete = async () => {
    try {
      await deleteIntegration(projectId);
      form.reset({ repositoryOwner: "", repositoryName: "" });
      setVerificationResult(null);
      toast.success("GitHub integration removed successfully");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to remove GitHub integration",
      );
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-4 bg-gray-200 rounded animate-pulse" />
        <div className="h-10 bg-gray-200 rounded animate-pulse" />
        <div className="h-10 bg-gray-200 rounded animate-pulse" />
      </div>
    );
  }

  const isConnected = !!integration && integration.isActive;

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
          <Github className="w-6 h-6" />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold">GitHub Integration</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Connect this project to a GitHub repository to automatically create
            issues when tasks are created in Kaneo.
          </p>
        </div>
      </div>

      {isConnected && (
        <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
          <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
          <span className="text-sm text-green-700 dark:text-green-300">
            Connected to{" "}
            <code className="px-1 py-0.5 bg-green-100 dark:bg-green-800 rounded text-xs">
              {integration.repositoryOwner}/{integration.repositoryName}
            </code>
          </span>
        </div>
      )}

      {verificationResult && (
        <div
          className={cn(
            "flex items-start gap-2 p-3 border rounded-lg",
            verificationResult.isInstalled &&
              verificationResult.hasRequiredPermissions
              ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
              : verificationResult.isInstalled
                ? "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800"
                : verificationResult.repositoryExists
                  ? "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800"
                  : "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800",
          )}
        >
          {verificationResult.isInstalled &&
          verificationResult.hasRequiredPermissions ? (
            <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
          ) : verificationResult.isInstalled ||
            verificationResult.repositoryExists ? (
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
          ) : (
            <XCircle className="w-4 h-4 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
          )}
          <div
            className={cn(
              "text-sm flex-1",
              verificationResult.isInstalled &&
                verificationResult.hasRequiredPermissions
                ? "text-green-700 dark:text-green-300"
                : verificationResult.isInstalled ||
                    verificationResult.repositoryExists
                  ? "text-amber-700 dark:text-amber-300"
                  : "text-red-700 dark:text-red-300",
            )}
          >
            <p className="font-medium">{verificationResult.message}</p>

            {verificationResult.isInstalled &&
              !verificationResult.hasRequiredPermissions &&
              verificationResult.missingPermissions && (
                <div className="mt-2">
                  <p className="text-xs mb-2">
                    Missing permissions:{" "}
                    <strong>
                      {verificationResult.missingPermissions.join(", ")}
                    </strong>
                  </p>
                  <div className="flex gap-2">
                    {verificationResult.settingsUrl && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          window.open(verificationResult.settingsUrl, "_blank")
                        }
                        className="gap-2"
                      >
                        <ExternalLink className="w-3 h-3" />
                        Update Permissions
                      </Button>
                    )}
                    {verificationResult.installationUrl && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          window.open(
                            verificationResult.installationUrl,
                            "_blank",
                          )
                        }
                        className="gap-2"
                      >
                        <ExternalLink className="w-3 h-3" />
                        Reinstall App
                      </Button>
                    )}
                  </div>
                </div>
              )}

            {!verificationResult.isInstalled &&
              verificationResult.repositoryExists && (
                <div className="mt-2 flex gap-2">
                  {verificationResult.installationUrl && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        window.open(
                          verificationResult.installationUrl,
                          "_blank",
                        )
                      }
                      className="gap-2"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Install GitHub App
                    </Button>
                  )}
                  {verificationResult.settingsUrl && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        window.open(verificationResult.settingsUrl, "_blank")
                      }
                      className="gap-2"
                    >
                      <ExternalLink className="w-3 h-3" />
                      View App Details
                    </Button>
                  )}
                </div>
              )}
          </div>
        </div>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="repositoryOwner"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Repository Owner</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., octocat"
                      {...field}
                      disabled={isCreating || isDeleting}
                    />
                  </FormControl>
                  <FormDescription>
                    The GitHub username or organization name
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="repositoryName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Repository Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., my-project"
                      {...field}
                      disabled={isCreating || isDeleting}
                    />
                  </FormControl>
                  <FormDescription>The repository name</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowRepositoryBrowser(true)}
              className="flex items-center gap-2"
            >
              <GitBranch className="w-4 h-4" />
              Browse Repositories
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={() => handleVerifyInstallation(form.getValues())}
              disabled={isVerifying || !form.formState.isValid}
              className="flex items-center gap-2"
            >
              <RefreshCw
                className={cn("w-4 h-4", isVerifying && "animate-spin")}
              />
              Verify Installation
            </Button>

            <Button
              type="submit"
              disabled={
                isCreating ||
                isDeleting ||
                !form.formState.isValid ||
                (verificationResult
                  ? !verificationResult.isInstalled ||
                    !verificationResult.hasRequiredPermissions
                  : false)
              }
              className="flex items-center gap-2"
            >
              <Link className="w-4 h-4" />
              {isConnected ? "Update Integration" : "Connect Repository"}
            </Button>

            {isConnected && (
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                disabled={isCreating || isDeleting}
                className="flex items-center gap-2"
              >
                <Unlink className="w-4 h-4" />
                Disconnect
              </Button>
            )}
          </div>
        </form>
      </Form>

      <RepositoryBrowserModal
        open={showRepositoryBrowser}
        onOpenChange={setShowRepositoryBrowser}
        onSelectRepository={handleRepositorySelect}
        selectedRepository={
          repositoryOwner && repositoryName
            ? `${repositoryOwner}/${repositoryName}`
            : undefined
        }
      />

      {!verificationResult?.isInstalled &&
        repositoryOwner &&
        repositoryName && (
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <div className="flex items-start gap-3">
              <Github className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
              <div className="text-sm text-blue-700 dark:text-blue-300">
                <p className="font-medium mb-2">
                  Need to install the GitHub App?
                </p>
                <p className="mb-3">
                  To use this integration, you need to install the Kaneo GitHub
                  App on your repository. This gives Kaneo permission to create
                  issues when tasks are created.
                </p>
                <div className="space-y-2">
                  <p className="text-xs">Steps to install:</p>
                  <ol className="list-decimal list-inside space-y-1 text-xs">
                    <li>Click "Install GitHub App" if available above</li>
                    <li>Or go to your GitHub App settings</li>
                    <li>
                      Select the repository:{" "}
                      <code className="px-1 py-0.5 bg-blue-100 dark:bg-blue-800 rounded">
                        {repositoryOwner}/{repositoryName}
                      </code>
                    </li>
                    <li>Grant necessary permissions (Issues: Write)</li>
                    <li>Come back and click "Verify Installation"</li>
                  </ol>
                </div>
              </div>
            </div>
          </div>
        )}

      {verificationResult?.isInstalled &&
        !verificationResult.hasRequiredPermissions && (
          <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5" />
              <div className="text-sm text-amber-700 dark:text-amber-300">
                <p className="font-medium mb-2">
                  App installed but permissions need updating
                </p>
                <p className="mb-3">
                  The GitHub App is installed on your repository but doesn't
                  have the required permissions to create issues. You need to
                  update the app permissions.
                </p>
                <div className="space-y-2">
                  <p className="text-xs">Required permissions:</p>
                  <ul className="list-disc list-inside space-y-1 text-xs">
                    <li>
                      Issues: <strong>Write</strong> (to create and update
                      issues)
                    </li>
                    <li>
                      Metadata: <strong>Read</strong> (to access repository
                      information)
                    </li>
                  </ul>
                  <p className="text-xs mt-2">
                    Click "Update Permissions" above or visit your
                    <a
                      href="https://github.com/settings/installations"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline hover:no-underline ml-1"
                    >
                      GitHub App settings
                    </a>
                    to modify permissions.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
    </div>
  );
}
