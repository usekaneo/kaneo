import { HTTPException } from "hono/http-exception";
import { httpExceptionResponse } from "./http-exception-response";

export function notFoundResponse() {
  return httpExceptionResponse(
    new HTTPException(404, { message: "Not found" }),
  );
}

export async function withJsonNotFound(response: Response): Promise<Response> {
  if (response.status !== 404 || response.body !== null) return response;
  return notFoundResponse();
}
