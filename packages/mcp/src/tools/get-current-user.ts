import { z } from "zod";
import type { ToolClient } from "./register.js";

const currentUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  role: z.string().nullish(),
});

export async function getCurrentUser(client: ToolClient) {
  if (client.usingApiKey) {
    const user = await client.json("/api/user/me", { method: "GET" });
    return currentUserSchema.parse(user);
  }

  const response = await client.json<{ user: unknown } | null>(
    "/api/auth/get-session",
    { method: "GET" },
  );
  return response === null ? null : currentUserSchema.parse(response.user);
}
