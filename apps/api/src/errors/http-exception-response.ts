import type { HTTPException } from "hono/http-exception";
import { ApiError, type ApiErrorBody } from "./api-error";
import { errorCodeForStatus } from "./error-code";

const FALLBACK_MESSAGE = "Request failed";

type CustomBody = { message?: unknown; code?: unknown; error?: unknown };

function parseCustomBody(text: string, contentType: string) {
  if (!contentType.includes("json")) return null;
  try {
    const value: unknown = JSON.parse(text);
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as CustomBody)
      : null;
  } catch {
    return null;
  }
}

function errorBody(
  error: HTTPException,
  status: number,
  message: string,
  customCode?: unknown,
): ApiErrorBody {
  if (error instanceof ApiError) {
    return {
      message,
      code: error.code,
      ...(error.issues ? { issues: error.issues } : {}),
      ...(error.missingPermissions
        ? { missingPermissions: error.missingPermissions }
        : {}),
    };
  }
  return {
    message,
    code:
      typeof customCode === "string" ? customCode : errorCodeForStatus(status),
  };
}

export async function httpExceptionResponse(
  error: HTTPException,
): Promise<Response> {
  const res = error.res;
  if (!res) {
    return Response.json(
      errorBody(error, error.status, error.message || FALLBACK_MESSAGE),
      { status: error.status },
    );
  }

  const text = await res.clone().text();
  const custom = parseCustomBody(text, res.headers.get("content-type") ?? "");
  if (typeof custom?.error === "string") return res;

  const customMessage =
    typeof custom?.message === "string" ? custom.message : custom ? "" : text;
  const headers = new Headers(res.headers);
  headers.delete("content-type");
  headers.delete("content-length");

  return Response.json(
    errorBody(
      error,
      res.status,
      customMessage || error.message || FALLBACK_MESSAGE,
      custom?.code,
    ),
    { status: res.status, headers },
  );
}
