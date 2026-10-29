import { expect, it } from "vite-plus/test";
import { HttpError } from "@/lib/http-error";
import { getAgentCodeErrorKey } from "./get-agent-code-error-key";

it("maps coding job failures to copy", () => {
  expect(getAgentCodeErrorKey(new HttpError(429, ""))).toBe(
    "agent:code.errors.limit",
  );
  expect(getAgentCodeErrorKey(new HttpError(409, ""))).toBe(
    "agent:code.errors.committing",
  );
  expect(getAgentCodeErrorKey(new HttpError(403, ""))).toBe(
    "agent:errors.forbidden",
  );
  expect(getAgentCodeErrorKey(new Error("offline"))).toBe(
    "agent:errors.generic",
  );
});
