import { bodyLimit } from "hono/body-limit";
import { HTTPException } from "hono/http-exception";

// Checked while the body streams in, before JSON parsing and validation, so
// an oversized request is refused without being buffered in full.
export function limitBody(maxBytes: number) {
  return bodyLimit({
    maxSize: maxBytes,
    onError: () => {
      throw new HTTPException(413, { message: "Request body is too large" });
    },
  });
}
