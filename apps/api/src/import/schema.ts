import { z } from "../openapi";

const NEVER_STORED = "Used only for this import and never stored or logged.";

function sourceUrl(description: string) {
  return z
    .string()
    .trim()
    .min(1)
    .max(2048)
    .openapi({ description, example: "https://planka.example.com" });
}

function secret(description: string) {
  return z
    .string()
    .trim()
    .min(1)
    .max(4096)
    .openapi({ description: `${description} ${NEVER_STORED}` });
}

const plankaConnection = z
  .object({
    source: z.literal("planka"),
    url: sourceUrl("Address of the PLANKA instance."),
    apiKey: secret(
      "A PLANKA API key. Send it, or username and password.",
    ).optional(),
    username: z.string().trim().min(1).max(256).optional().openapi({
      description:
        "Username or email of a PLANKA account, used with password when no API key is sent.",
    }),
    password: z
      .string()
      .min(1)
      .max(4096)
      .optional()
      .openapi({
        description: `Password of that PLANKA account. ${NEVER_STORED}`,
      }),
  })
  .refine(
    (connection) =>
      Boolean(connection.apiKey) ||
      Boolean(connection.username && connection.password),
    {
      message: "Enter a PLANKA API key, or a username and password",
      path: ["apiKey"],
    },
  )
  .openapi("PlankaImportConnection");

const planeConnection = z
  .object({
    source: z.literal("plane"),
    url: sourceUrl(
      "Address of the Plane instance, e.g. https://app.plane.so for Plane Cloud.",
    ),
    apiKey: secret("A Plane personal access token."),
    workspaceSlug: z.string().trim().min(1).max(256).optional().openapi({
      description:
        "Slug of the Plane workspace to read. Optional when the URL already names it.",
    }),
  })
  .openapi("PlaneImportConnection");

const linearConnection = z
  .object({
    source: z.literal("linear"),
    apiKey: secret("A Linear personal API key."),
  })
  .openapi("LinearImportConnection");

const trelloConnection = z
  .object({
    source: z.literal("trello"),
    token: secret("A Trello token authorized for this Kaneo instance."),
    apiKey: z.string().trim().min(1).max(256).optional().openapi({
      description:
        "Trello API key, a public app identifier. Defaults to the server's TRELLO_API_KEY.",
    }),
  })
  .openapi("TrelloImportConnection");

const kaneoConnection = z
  .object({
    source: z.literal("kaneo"),
    url: sourceUrl("Address of the Kaneo instance to import from."),
    apiKey: secret("An API key from that Kaneo instance."),
  })
  .openapi("KaneoImportConnection");

export const importConnectionSchema = z
  .discriminatedUnion("source", [
    plankaConnection,
    planeConnection,
    linearConnection,
    trelloConnection,
    kaneoConnection,
  ])
  .openapi("ImportConnection", {
    description: `Where to import from and how to sign in. Credentials are used only for this request and the import it starts; they are never stored, logged, or returned.`,
  });

export type ImportConnectionInput = z.infer<typeof importConnectionSchema>;

export const listImportSourceProjectsBody = z.object({
  workspaceId: z.string().min(1),
  connection: importConnectionSchema,
});

export const startImportRunBody = z.object({
  workspaceId: z.string().min(1),
  connection: importConnectionSchema,
  projectIds: z
    .array(z.string().trim().min(1).max(512))
    .min(1)
    .max(50)
    .refine((ids) => new Set(ids).size === ids.length, {
      message: "Project IDs must be unique",
    })
    .openapi({
      description:
        "Source project IDs from listImportSourceProjects, imported in this order.",
    }),
  includeComments: z.boolean().default(true).openapi({
    description: "Import task comments too. Defaults to true.",
  }),
});

export const workspaceIdParam = z.object({ workspaceId: z.string() });

export const importRunParam = z.object({
  workspaceId: z.string(),
  runId: z.string(),
});
