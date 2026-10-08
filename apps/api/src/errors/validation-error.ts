import { ApiError } from "./api-error";
import {
  formatValidationIssues,
  type ValidationIssueInput,
} from "./validation-issues";

type ValidationResult = {
  success: boolean;
  target?: string;
  error?: { issues: readonly ValidationIssueInput[] };
};

export function validationError(
  issues: readonly ValidationIssueInput[],
  target?: string,
  message?: string,
) {
  const formatted = formatValidationIssues(issues, target);
  return new ApiError(400, {
    message: message ?? formatted.message,
    code: "VALIDATION_ERROR",
    issues: formatted.issues,
  });
}

export function validationHook(result: ValidationResult): undefined {
  if (result.success) return;
  throw validationError(result.error?.issues ?? [], result.target);
}

export function validationHookWithMessage(message: string) {
  return (result: ValidationResult): undefined => {
    if (result.success) return;
    throw validationError(result.error?.issues ?? [], result.target, message);
  };
}
