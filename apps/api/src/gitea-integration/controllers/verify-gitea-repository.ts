/**
 * @fileoverview Gitea Repository Verification Controller
 * Handles repository accessibility and configuration validation with resilient error handling
 */

/**
 * Retry configuration for API calls
 */
const RETRY_CONFIG = {
  maxAttempts: 3,
  baseDelay: 200, // milliseconds
  maxDelay: 2000,
  retryableStatusCodes: [408, 429, 500, 502, 503, 504],
} as const;

/**
 * Execute API operation with exponential backoff retry for network resilience
 * @param operation - API operation to retry
 * @param context - Operation context for logging
 * @returns Operation result
 */
async function withApiRetry<T>(
  operation: () => Promise<T>,
  context: string,
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= RETRY_CONFIG.maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;

      // Check if error is retryable (network/server errors)
      const errorWithStatus = error as Error & { status?: number };
      const isRetryable =
        error instanceof TypeError || // Network errors
        (errorWithStatus.status &&
          (RETRY_CONFIG.retryableStatusCodes as readonly number[]).includes(
            errorWithStatus.status,
          ));

      console.warn(
        `${context} failed (attempt ${attempt}/${RETRY_CONFIG.maxAttempts}):`,
        error,
      );

      // Don't retry on the last attempt or non-retryable errors
      if (attempt === RETRY_CONFIG.maxAttempts || !isRetryable) {
        break;
      }

      // Calculate exponential backoff delay
      const delay = Math.min(
        RETRY_CONFIG.baseDelay * 2 ** (attempt - 1),
        RETRY_CONFIG.maxDelay,
      );

      console.log(`Retrying ${context} in ${delay}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  console.error(
    `${context} failed after ${RETRY_CONFIG.maxAttempts} attempts:`,
    lastError,
  );
  throw lastError;
}

/**
 * Gitea repository verification response structure
 *
 * @example Successful verification
 * ```typescript
 * {
 *   repositoryExists: true,
 *   isAccessible: true,
 *   hasIssuesEnabled: true,
 *   message: "Repository verified successfully"
 * }
 * ```
 */
export interface VerifyGiteaRepositoryResponse {
  repositoryExists: boolean;
  isAccessible: boolean;
  hasIssuesEnabled: boolean;
  message: string;
}

/**
 * Verify Gitea repository accessibility and configuration with resilient API calls
 *
 * @param params - Repository verification parameters
 * @returns Verification result with detailed status information
 *
 * @example Basic verification
 * ```typescript
 * const result = await verifyGiteaRepository({
 *   giteaUrl: "https://gitea.example.com",
 *   repositoryOwner: "user",
 *   repositoryName: "repo",
 *   accessToken: "token_123"
 * });
 *
 * if (result.isAccessible && result.hasIssuesEnabled) {
 *   console.log("Repository ready for integration");
 * }
 * ```
 *
 * @performance
 * - Retry logic for network resilience
 * - Exponential backoff for API rate limiting
 * - Comprehensive error categorization
 */
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
    // Validate URL format early
    const parsedUrl = new URL(giteaUrl);
    if (!parsedUrl.protocol.startsWith("http")) {
      throw new Error("Invalid Gitea URL format");
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `token ${accessToken}`,
      "User-Agent": "Kaneo-Integration/1.0",
    };

    const apiUrl = new URL(
      `/api/v1/repos/${repositoryOwner}/${repositoryName}`,
      giteaUrl,
    );

    // Use retry logic for API call resilience
    const response = await withApiRetry(async () => {
      const res = await fetch(apiUrl.toString(), {
        method: "GET",
        headers,
      });

      // Attach status for retry decision making
      if (!res.ok) {
        const error = new Error(
          `HTTP ${res.status}: ${res.statusText}`,
        ) as Error & { status: number };
        error.status = res.status;
        throw error;
      }

      return res;
    }, `Verify Gitea repository ${repositoryOwner}/${repositoryName}`);

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
      hasIssuesEnabled: true,
      message: "Repository verified successfully",
    };
  } catch (error) {
    console.error("Repository verification failed:", error);

    // Handle specific error types for better user feedback
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    if (errorMessage.includes("404")) {
      return {
        repositoryExists: false,
        isAccessible: false,
        hasIssuesEnabled: false,
        message: "Repository not found or not accessible",
      };
    }

    if (errorMessage.includes("403")) {
      return {
        repositoryExists: true,
        isAccessible: false,
        hasIssuesEnabled: false,
        message: "Repository exists but access token lacks permissions",
      };
    }

    // Network or other errors
    return {
      repositoryExists: false,
      isAccessible: false,
      hasIssuesEnabled: false,
      message: `Verification failed: ${errorMessage}`,
    };
  }
}

export default verifyGiteaRepository;
