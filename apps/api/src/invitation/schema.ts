import { z } from "../openapi";

export const invitationParam = z.object({ id: z.string() });
