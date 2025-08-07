import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import type { VerifyGiteaRepositoryResponse } from "@/fetchers/gitea-integration/verify-gitea-repository";
import {
  useCreateGiteaIntegration,
  useDeleteGiteaIntegration,
  useVerifyGiteaRepository,
} from "@/hooks/mutations/gitea-integration/use-create-gitea-integration";
import useImportGiteaIssues from "@/hooks/mutations/gitea-integration/use-import-gitea-issues";
import useGetGiteaIntegration from "@/hooks/queries/gitea-integration/use-get-gitea-integration";
import { cn } from "@/lib/cn";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import {
  AlertTriangle,
  CheckCircle,
  Download,
  ExternalLink,
  Import,
  Link,
  RefreshCw,
  Server,
  Settings,
  Unlink,
  XCircle,
} from "lucide-react";
import React from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod/v4";

const giteaIntegrationSchema = z.object({
  giteaUrl: z
    .string()
    .min(1, "Gitea URL is required")
    .url("Please enter a valid URL"),
  repositoryOwner: z
    .string()
    .min(1, "Repository owner is required")
    .regex(/^[a-zA-Z0-9-]+$/, "Invalid repository owner format"),
  repositoryName: z
    .string()
    .min(1, "Repository name is required")
    .regex(/^[a-zA-Z0-9._-]+$/, "Invalid repository name format"),
  accessToken: z.string().optional(),
  webhookSecret: z.string().optional(),
});

type GiteaIntegrationFormValues = z.infer<typeof giteaIntegrationSchema>;

export function GiteaIntegrationSettings({ projectId }: { projectId: string }) {
  const { data: integration, isLoading } = useGetGiteaIntegration(projectId);
  const { mutateAsync: createIntegration, isPending: isCreating } =
    useCreateGiteaIntegration();
  const { mutateAsync: deleteIntegration, isPending: isDeleting } =
    useDeleteGiteaIntegration();
  const { mutateAsync: verifyRepository, isPending: isVerifying } =
    useVerifyGiteaRepository();
  const { mutateAsync: importIssues, isPending: isImporting } =
    useImportGiteaIssues();

  const [verificationResult, setVerificationResult] =
    React.useState<VerifyGiteaRepositoryResponse | null>(null);

  const form = useForm<GiteaIntegrationFormValues>({
    resolver: standardSchemaResolver(giteaIntegrationSchema),
    defaultValues: {
      giteaUrl: integration?.giteaUrl || "",
      repositoryOwner: integration?.repositoryOwner || "",
      repositoryName: integration?.repositoryName || "",
      accessToken: "",
      webhookSecret: "",
    },
  });

  React.useEffect(() => {
    if (integration) {
      form.reset({
        giteaUrl: integration.giteaUrl,
        repositoryOwner: integration.repositoryOwner,
        repositoryName: integration.repositoryName,
        accessToken: integration.accessToken || "",
        webhookSecret: integration.webhookSecret || "",
      });
    }
  }, [integration, form]);

  const giteaUrl = form.watch("giteaUrl");
  const repositoryOwner = form.watch("repositoryOwner");
  const repositoryName = form.watch("repositoryName");

  const handleVerifyRepository = React.useCallback(
    async (data: GiteaIntegrationFormValues, showToast = true) => {
      try {
        const result = await verifyRepository({
          giteaUrl: data.giteaUrl,
          repositoryOwner: data.repositoryOwner,
          repositoryName: data.repositoryName,
          accessToken: data.accessToken || undefined,
        });
        setVerificationResult(result);

        if (showToast) {
          if (result.repositoryExists && result.hasIssuesEnabled) {
            toast.success("Repository is accessible and issues are enabled!");
          } else if (result.repositoryExists) {
            toast.warning("Repository found but issues are disabled");
          } else {
            toast.error("Repository not found or not accessible");
          }
        }
      } catch (error) {
        if (showToast) {
          toast.error(
            error instanceof Error
              ? error.message
              : "Failed to verify Gitea repository",
          );
        }
        setVerificationResult(null);
      }
    },
    [verifyRepository],
  );

  React.useEffect(() => {
    if (
      giteaUrl &&
      repositoryOwner &&
      repositoryName &&
      form.formState.isValid
    ) {
      handleVerifyRepository(form.getValues(), false);
    }
  }, [
    giteaUrl,
    repositoryOwner,
    repositoryName,
    form.formState.isValid,
    form.getValues,
    handleVerifyRepository,
  ]);

  const onSubmit = async (data: GiteaIntegrationFormValues) => {
    try {
      const verification = await verifyRepository({
        giteaUrl: data.giteaUrl,
        repositoryOwner: data.repositoryOwner,
        repositoryName: data.repositoryName,
        accessToken: data.accessToken || undefined,
      });

      if (!verification.repositoryExists) {
        toast.error("Repository not found or not accessible");
        return;
      }

      if (!verification.hasIssuesEnabled) {
        toast.error(
          "Repository issues are disabled. Please enable issues in your Gitea repository.",
        );
        return;
      }

      await createIntegration({
        projectId,
        data: {
          giteaUrl: data.giteaUrl,
          repositoryOwner: data.repositoryOwner,
          repositoryName: data.repositoryName,
          accessToken: data.accessToken || undefined,
          webhookSecret: data.webhookSecret || undefined,
        },
      });
      toast.success("Gitea integration updated successfully");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to update Gitea integration",
      );
    }
  };

  const handleDelete = async () => {
    try {
      await deleteIntegration(projectId);
      form.reset({
        giteaUrl: "",
        repositoryOwner: "",
        repositoryName: "",
        accessToken: "",
        webhookSecret: "",
      });
      setVerificationResult(null);
      toast.success("Gitea integration removed successfully");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to remove Gitea integration",
      );
    }
  };

  const handleImportIssues = async () => {
    try {
      await importIssues({ projectId });
      toast.success("Issues imported successfully");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to import issues",
      );
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
                <Server className="w-6 h-6" />
              </div>
              <div>
                <div className="h-5 bg-gray-200 rounded animate-pulse w-40" />
                <div className="h-4 bg-gray-200 rounded animate-pulse w-64 mt-2" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="h-4 bg-gray-200 rounded animate-pulse" />
              <div className="h-10 bg-gray-200 rounded animate-pulse" />
              <div className="h-10 bg-gray-200 rounded animate-pulse" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isConnected = !!integration && integration.isActive;
  const canImport =
    isConnected &&
    verificationResult?.repositoryExists &&
    verificationResult?.hasIssuesEnabled;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Connection Status</CardTitle>
            {isConnected && (
              <Badge variant="secondary" className="gap-1">
                <CheckCircle className="w-3 h-3" />
                Connected
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isConnected ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <Server className="w-4 h-4" />
                <span className="font-medium">
                  {integration.repositoryOwner}/{integration.repositoryName}
                </span>
                <a
                  href={`${integration.giteaUrl}/${integration.repositoryOwner}/${integration.repositoryName}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800"
                >
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              <div className="flex items-center gap-2 text-sm text-gray-600">
                <span>Host: {integration.giteaUrl}</span>
              </div>

              {verificationResult && (
                <div className="flex items-center gap-2 text-sm">
                  {verificationResult.repositoryExists &&
                  verificationResult.hasIssuesEnabled ? (
                    <>
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      <span className="text-green-700">
                        Repository accessible, issues enabled
                      </span>
                    </>
                  ) : verificationResult.repositoryExists ? (
                    <>
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                      <span className="text-amber-700">Issues disabled</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-4 h-4 text-red-600" />
                      <span className="text-red-700">
                        Repository not accessible
                      </span>
                    </>
                  )}
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-600 dark:text-gray-400">
              No repository connected. Configure a repository below to get
              started.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Settings className="w-4 h-4" />
            Repository Configuration
          </CardTitle>
          <CardDescription>
            Connect to a Gitea repository to enable issue synchronization
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="giteaUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Gitea URL</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="https://gitea.example.com"
                        {...field}
                        disabled={isCreating || isDeleting}
                      />
                    </FormControl>
                    <FormDescription>
                      The base URL of your Gitea instance
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="repositoryOwner"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Repository Owner</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., username"
                          {...field}
                          disabled={isCreating || isDeleting}
                        />
                      </FormControl>
                      <FormDescription>
                        Gitea username or organization
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

              <FormField
                control={form.control}
                name="accessToken"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Access Token (Optional)</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="Access token for private repositories"
                        {...field}
                        disabled={isCreating || isDeleting}
                      />
                    </FormControl>
                    <FormDescription>
                      Required for private repositories or to enable webhook
                      features
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="webhookSecret"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Webhook Secret (Optional)</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="Secret for webhook verification"
                        {...field}
                        disabled={isCreating || isDeleting}
                      />
                    </FormControl>
                    <FormDescription>
                      Used to verify webhook authenticity
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleVerifyRepository(form.getValues())}
                  disabled={isVerifying || !form.formState.isValid}
                  className="gap-2"
                >
                  <RefreshCw
                    className={cn("w-4 h-4", isVerifying && "animate-spin")}
                  />
                  Verify
                </Button>

                <Button
                  type="submit"
                  size="sm"
                  disabled={
                    isCreating ||
                    isDeleting ||
                    !form.formState.isValid ||
                    (verificationResult
                      ? !verificationResult.repositoryExists ||
                        !verificationResult.hasIssuesEnabled
                      : false)
                  }
                  className="gap-2"
                >
                  <Link className="w-4 h-4" />
                  {isConnected ? "Update" : "Connect"}
                </Button>

                {isConnected && (
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={handleDelete}
                    disabled={isCreating || isDeleting}
                    className="gap-2"
                  >
                    <Unlink className="w-4 h-4" />
                    Disconnect
                  </Button>
                )}
              </div>
            </form>
          </Form>

          {verificationResult && (
            <div className="mt-4">
              <div
                className={cn(
                  "flex items-start gap-3 p-3 border rounded-lg text-sm",
                  verificationResult.repositoryExists &&
                    verificationResult.hasIssuesEnabled
                    ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
                    : verificationResult.repositoryExists
                      ? "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800"
                      : "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800",
                )}
              >
                {verificationResult.repositoryExists &&
                verificationResult.hasIssuesEnabled ? (
                  <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                ) : verificationResult.repositoryExists ? (
                  <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                )}
                <div className="flex-1">
                  <p className="font-medium">{verificationResult.message}</p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {isConnected && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Download className="w-4 h-4" />
              Actions
            </CardTitle>
            <CardDescription>
              Import existing issues from Gitea or manage your integration
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-start gap-4 p-4 border border-zinc-200 dark:border-zinc-800 rounded-lg bg-zinc-50/50 dark:bg-zinc-800/20 hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors">
                <div className="p-2 bg-zinc-100 dark:bg-zinc-800/50 rounded-lg">
                  <Import className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
                </div>
                <div className="flex-1">
                  <h4 className="font-medium mb-1 text-zinc-900 dark:text-zinc-100">
                    Import Gitea Issues
                  </h4>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-3">
                    Import existing issues from your Gitea repository as tasks
                    in this project.
                  </p>
                  <Button
                    onClick={handleImportIssues}
                    disabled={isImporting || !canImport}
                    className="gap-2"
                    size="sm"
                  >
                    {isImporting ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Import className="w-4 h-4" />
                    )}
                    {isImporting ? "Importing..." : "Import Issues"}
                  </Button>
                  {!canImport && (
                    <p className="text-xs text-zinc-500 dark:text-zinc-500 mt-2">
                      Complete the repository configuration above to enable
                      importing
                    </p>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
