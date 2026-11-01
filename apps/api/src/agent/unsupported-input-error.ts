import { APICallError } from "ai";
import { UnsupportedFunctionalityError } from "@ai-sdk/provider";

// Stored on the run; the web client maps this exact text to translated copy.
export const UNSUPPORTED_ATTACHMENTS_ERROR =
  "The model cannot read these attachments; remove them or use a model with image input";

// OpenRouter answers e.g. 404 "No endpoints found that support image input"
// when no provider for the model accepts the attached modality.
const UNSUPPORTED_INPUT =
  /image input|file input|support (image|file|pdf)|input modalit|does not support (image|file|pdf|vision)/i;

export function isUnsupportedInputError(error: unknown) {
  if (UnsupportedFunctionalityError.isInstance(error))
    return /\b(image|file|pdf|vision)\b/i.test(error.functionality);
  if (!APICallError.isInstance(error)) return false;
  if (error.statusCode !== 400 && error.statusCode !== 404) return false;
  return UNSUPPORTED_INPUT.test(
    `${error.message}\n${error.responseBody ?? ""}`,
  );
}
