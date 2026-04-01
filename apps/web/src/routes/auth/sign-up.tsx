import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod/v4";

const signUpSearchSchema = z.object({
  invitationId: z.string().optional(),
  email: z.string().optional(),
});

export const Route = createFileRoute("/auth/sign-up")({
  beforeLoad: ({ search }) => {
    throw redirect({
      to: "/auth/sign-in",
      search,
    });
  },
  validateSearch: signUpSearchSchema,
});
