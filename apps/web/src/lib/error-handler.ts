export type ApiError = {
  message: string;
  type: "network" | "cors" | "auth" | "server" | "unknown";
  status?: number;
  originalError?: Error;
};

export function parseApiError(error: unknown): ApiError {
  if (error instanceof Error) {
    if (
      error.message.includes("Failed to fetch") ||
      error.message.includes("NetworkError") ||
      error.message.includes("CORS")
    ) {
      return {
        message:
          "Unable to connect to the server. This might be due to CORS configuration issues.",
        type: "cors",
        originalError: error,
      };
    }

    if (
      error.message.includes("fetch") ||
      error.message.includes("network") ||
      error.message.includes("connection")
    ) {
      return {
        message:
          "Network error. Please check your internet connection and try again.",
        type: "network",
        originalError: error,
      };
    }

    if (
      error.message.includes("401") ||
      error.message.includes("unauthorized") ||
      error.message.includes("authentication")
    ) {
      return {
        message: "Authentication failed. Please sign in again.",
        type: "auth",
        status: 401,
        originalError: error,
      };
    }

    // Check for server errors
    if (
      error.message.includes("500") ||
      error.message.includes("server error") ||
      error.message.includes("internal")
    ) {
      return {
        message: "Server error. Please try again later.",
        type: "server",
        status: 500,
        originalError: error,
      };
    }

    return {
      message: error.message || "An unexpected error occurred.",
      type: "unknown",
      originalError: error,
    };
  }

  return {
    message: "An unexpected error occurred.",
    type: "unknown",
  };
}

export function getCorsTroubleshootingSteps(): string[] {
  return [
    "Make sure your API server is running",
    "Check that VITE_API_URL in your frontend .env matches your API server URL",
    "Verify CORS_ORIGINS in your API .env includes your frontend URL",
    "Ensure both frontend and API are using the same protocol (http/https)",
    "Check that your API server is accessible from your browser",
  ];
}

export function getNetworkTroubleshootingSteps(): string[] {
  return [
    "Check your internet connection",
    "Verify the API server is running and accessible",
    "Try refreshing the page",
    "Check if there are any firewall or proxy issues",
  ];
}
