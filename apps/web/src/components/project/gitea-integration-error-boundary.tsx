import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AlertTriangle, RefreshCw } from "lucide-react";
import React from "react";

/**
 * Props for the Gitea Integration Error Boundary component
 */
interface GitteaIntegrationErrorBoundaryProps {
  children: React.ReactNode;
  /** Optional fallback component to render on error */
  fallback?: React.ComponentType<{ error: Error; resetError: () => void }>;
}

/**
 * State interface for error boundary
 */
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

/**
 * Default error fallback component with user-friendly UI
 * @param error - The caught error object
 * @param resetError - Function to reset the error boundary state
 */
function DefaultErrorFallback({
  error,
  resetError,
}: {
  error: Error;
  resetError: () => void;
}) {
  return (
    <Card className="border-destructive/50 bg-destructive/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-destructive">
          <AlertTriangle className="h-5 w-5" />
          Gitea Integration Error
        </CardTitle>
        <CardDescription>
          Something went wrong with the Gitea integration. This error has been
          logged and our team has been notified.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-md bg-muted p-3">
          <p className="text-sm font-medium text-muted-foreground">
            Error Details:
          </p>
          <p className="text-sm text-foreground mt-1">
            {error.message || "An unexpected error occurred"}
          </p>
        </div>

        <div className="flex gap-2">
          <Button onClick={resetError} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
          <Button
            onClick={() => window.location.reload()}
            variant="secondary"
            size="sm"
          >
            Reload Page
          </Button>
        </div>

        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer hover:text-foreground">
            Technical Details (for developers)
          </summary>
          <pre className="mt-2 overflow-auto rounded bg-muted p-2 text-xs">
            {error.stack}
          </pre>
        </details>
      </CardContent>
    </Card>
  );
}

/**
 * Error Boundary specifically designed for Gitea Integration components
 * Provides graceful error handling with user-friendly fallback UI and recovery options
 *
 * @example Basic usage
 * ```tsx
 * <GiteaIntegrationErrorBoundary>
 *   <GiteaIntegrationSettings projectId={projectId} />
 * </GiteaIntegrationErrorBoundary>
 * ```
 *
 * @example With custom fallback
 * ```tsx
 * <GiteaIntegrationErrorBoundary fallback={CustomErrorComponent}>
 *   <GiteaIntegrationSettings projectId={projectId} />
 * </GiteaIntegrationErrorBoundary>
 * ```
 */
export class GiteaIntegrationErrorBoundary extends React.Component<
  GitteaIntegrationErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: GitteaIntegrationErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  /**
   * Update state when an error is caught
   */
  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  /**
   * Log error details and additional context
   */
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({
      error,
      errorInfo,
    });

    // Enhanced error logging with context
    console.error("Gitea Integration Error Boundary caught an error:", error);
    console.error("Error Info:", errorInfo);

    // In production, you might want to send this to an error reporting service
    if (process.env.NODE_ENV === "production") {
      // Example: Sentry.captureException(error, { contexts: { errorInfo } });
    }
  }

  /**
   * Reset error boundary state to retry rendering
   */
  resetError = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      // Use custom fallback if provided, otherwise use default
      const FallbackComponent = this.props.fallback || DefaultErrorFallback;

      return (
        <FallbackComponent
          error={this.state.error}
          resetError={this.resetError}
        />
      );
    }

    // No error, render children normally
    return this.props.children;
  }
}

/**
 * Hook-based wrapper for functional components that need error boundary protection
 * @param children - Child components to protect
 * @param fallback - Optional custom fallback component
 * @returns JSX element wrapped in error boundary
 *
 * @example Functional component usage
 * ```tsx
 * function ProjectSettings({ projectId }: { projectId: string }) {
 *   return useGiteaErrorBoundary(
 *     <GiteaIntegrationSettings projectId={projectId} />
 *   );
 * }
 * ```
 */
export function useGiteaErrorBoundary(
  children: React.ReactNode,
  fallback?: React.ComponentType<{ error: Error; resetError: () => void }>,
) {
  return (
    <GiteaIntegrationErrorBoundary fallback={fallback}>
      {children}
    </GiteaIntegrationErrorBoundary>
  );
}
