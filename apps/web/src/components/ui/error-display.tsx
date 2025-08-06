import { AlertTriangle, ExternalLink, RefreshCw } from "lucide-react";
import {
  getCorsTroubleshootingSteps,
  getNetworkTroubleshootingSteps,
  parseApiError,
} from "../../lib/error-handler";
import { Button } from "./button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./card";

interface ErrorDisplayProps {
  error: unknown;
  onRetry?: () => void;
  title?: string;
  className?: string;
}

export function ErrorDisplay({
  error,
  onRetry,
  title = "Something went wrong",
  className,
}: ErrorDisplayProps) {
  const parsedError = parseApiError(error);

  const getTroubleshootingSteps = () => {
    switch (parsedError.type) {
      case "cors":
        return getCorsTroubleshootingSteps();
      case "network":
        return getNetworkTroubleshootingSteps();
      default:
        return [];
    }
  };

  const troubleshootingSteps = getTroubleshootingSteps();

  return (
    <div
      className={`flex items-center justify-center min-h-[400px] p-6 ${className}`}
    >
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-4">
            <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
          </div>
          <CardTitle className="text-lg">{title}</CardTitle>
          <CardDescription className="text-sm">
            {parsedError.message}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {troubleshootingSteps.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                Troubleshooting steps:
              </h4>
              <ul className="text-xs text-zinc-600 dark:text-zinc-400 space-y-1">
                {troubleshootingSteps.map((step, index) => (
                  <li
                    key={`step-${index}-${step.slice(0, 10)}`}
                    className="flex items-start gap-2"
                  >
                    <span className="text-zinc-400 dark:text-zinc-500 mt-0.5">
                      •
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-col gap-2 pt-2">
            {onRetry && (
              <Button
                onClick={onRetry}
                variant="outline"
                size="sm"
                className="w-full"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Try Again
              </Button>
            )}

            {parsedError.type === "cors" && (
              <Button
                onClick={() => window.open("https://kaneo.app/docs", "_blank")}
                variant="outline"
                size="icon"
                className="w-full"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                View Deployment Guide
              </Button>
            )}

            <Button
              onClick={() => window.location.reload()}
              variant="outline"
              size="icon"
              className="w-full"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh Page
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
