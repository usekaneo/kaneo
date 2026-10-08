import { definePlugin } from "@kaneo/plugin-sdk";
import { z } from "zod";

export const options = z.object({
  autoComplete: z.boolean().default(true),
});

export default definePlugin(import.meta.url, { options });
