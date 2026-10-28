import { z } from "@hono/zod-openapi";

export const apiErrorSchema = z
  .object({
    message: z.string().openapi({
      description: "Human-readable description of the error.",
      example: "Task not found",
    }),
    code: z.string().openapi({
      description:
        "Stable UPPER_SNAKE_CASE code. Derived from the status unless a more specific code applies, such as VALIDATION_ERROR or MISSING_PERMISSION.",
      example: "NOT_FOUND",
    }),
    issues: z
      .array(
        z.object({
          path: z.string().openapi({
            description:
              "Dotted path to the invalid input, prefixed with the request part (body, query, params, header).",
            example: "body.title",
          }),
          message: z.string().openapi({ example: "Required" }),
        }),
      )
      .optional()
      .openapi({
        description: "Every validation issue, for VALIDATION_ERROR.",
      }),
    missingPermissions: z
      .array(z.string())
      .optional()
      .openapi({
        description:
          "Permissions the caller lacks for this route, as resource:action, for MISSING_PERMISSION and API_KEY_SCOPE.",
        example: ["task:update"],
      }),
  })
  .openapi("ApiError");
