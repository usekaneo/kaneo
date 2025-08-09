export interface VerifyGiteaRepositoryResponse {
  repositoryExists: boolean;
  isAccessible: boolean;
  hasIssuesEnabled: boolean;
  message: string;
}

async function verifyGiteaRepository({
  giteaUrl,
  repositoryOwner,
  repositoryName,
  accessToken,
}: {
  giteaUrl: string;
  repositoryOwner: string;
  repositoryName: string;
  accessToken: string;
}): Promise<VerifyGiteaRepositoryResponse> {
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `token ${accessToken}`,
    };

    const url = new URL(
      `/api/v1/repos/${repositoryOwner}/${repositoryName}`,
      giteaUrl,
    );

    const response = await fetch(url.toString(), {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      if (response.status === 404) {
        return {
          repositoryExists: false,
          isAccessible: false,
          hasIssuesEnabled: false,
          message: "Repository not found or not accessible",
        };
      }

      const errorText = await response.text();
      throw new Error(
        `Gitea API error: ${response.status} ${response.statusText} - ${errorText}`,
      );
    }

    const repository = (await response.json()) as {
      name: string;
      full_name: string;
      has_issues: boolean;
      permissions?: {
        admin?: boolean;
        push?: boolean;
        pull?: boolean;
      };
    };

    const isAccessible = !!repository;
    const hasIssuesEnabled = repository.has_issues;

    if (!hasIssuesEnabled) {
      return {
        repositoryExists: true,
        isAccessible,
        hasIssuesEnabled: false,
        message: "Repository found but issues are disabled",
      };
    }

    return {
      repositoryExists: true,
      isAccessible,
      hasIssuesEnabled,
      message: "Repository is accessible and issues are enabled",
    };
  } catch (error) {
    if (error instanceof Error && error.message.includes("404")) {
      return {
        repositoryExists: false,
        isAccessible: false,
        hasIssuesEnabled: false,
        message: "Repository not found or not accessible",
      };
    }

    return {
      repositoryExists: false,
      isAccessible: false,
      hasIssuesEnabled: false,
      message: `Failed to verify repository: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

export default verifyGiteaRepository;
