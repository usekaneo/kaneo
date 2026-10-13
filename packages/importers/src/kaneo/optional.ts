import { SourceHttpError } from "../http.js";

export type OptionalResult<T> =
  | { status: "ok"; value: T }
  | { status: "gone" }
  | { status: "unsupported" };

const RESOURCE_GONE = /^(task|project|workspace) not found$/i;

export async function readOptional<T>(
  request: () => Promise<T>,
): Promise<OptionalResult<T>> {
  try {
    return { status: "ok", value: await request() };
  } catch (error) {
    if (!(error instanceof SourceHttpError) || error.status !== 404) {
      throw error;
    }
    return { status: isResourceGone(error.body) ? "gone" : "unsupported" };
  }
}

function isResourceGone(body: unknown): boolean {
  if (typeof body !== "object" || body === null) return false;
  const message = (body as Record<string, unknown>).message;
  return typeof message === "string" && RESOURCE_GONE.test(message.trim());
}
