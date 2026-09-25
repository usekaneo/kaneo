import type { Guide } from "./types";

export const projectManagementMcpAiAgents: Guide = {
  slug: "project-management-mcp-ai-agents",
  question: "Which project management tools work with AI agents through MCP?",
  title: "Project management tools with an MCP server for AI agents",
  description:
    "How Model Context Protocol connects Claude, Cursor, and other AI clients to your project tracker, which tools ship an MCP server, and what to watch for on permissions.",
  summary:
    "How MCP connects AI clients to your tracker, and what to check before you let one write.",
  answer:
    "Model Context Protocol is the standard way an AI client such as Claude or Cursor talks to an external system, and a growing number of project tools ship an MCP server. Kaneo has one, published as @kaneo/mcp for stdio clients and available as an HTTP endpoint on your instance, so an agent can list projects, create and update tasks, move them between columns, comment, and log time. The thing to check in any implementation is that the agent inherits your permissions rather than an admin key.",
  sections: [
    {
      heading: "What MCP actually is",
      body: [
        "A protocol that lets an AI client discover the tools a system exposes and call them with structured arguments. Instead of writing an integration per assistant, a product ships one MCP server and every compatible client can use it.",
        "In practice it turns natural instructions into API calls. Asking an assistant to move everything blocked on the design review into next week becomes a series of authorised task updates, run against your tracker.",
      ],
    },
    {
      heading: "How it works in Kaneo",
      items: [
        {
          name: "Stdio server",
          href: "/docs/core/integrations/mcp",
          body: "The @kaneo/mcp package runs locally and connects a desktop client such as Claude Desktop to your Kaneo instance using an API key from workspace settings.",
        },
        {
          name: "HTTP endpoint",
          href: "/docs/core/integrations/mcp-stateless",
          body: "Your Kaneo instance exposes MCP over HTTP for clients that connect to a remote server, including self-hosted deployments behind your own domain.",
        },
        {
          name: "What an agent can do",
          body: "List workspaces and projects, search, read and create tasks, update status, assignee, and due date, move tasks between columns, manage labels and relations, read and write comments, and record time entries.",
        },
        {
          name: "Permissions",
          body: "MCP access runs through an API key tied to a user, so an agent sees exactly what that person sees. Workspace roles from @kaneo/permissions still apply, and the API remains the authority regardless of what the client asks for.",
        },
      ],
    },
    {
      heading: "What to check before letting an agent write",
      body: [
        "Whose permissions does it use? An integration that authenticates with an admin token gives every agent full reach. A per-user API key keeps the blast radius the size of one person's access.",
        "Is there an audit trail? Changes an agent makes should appear in activity history like anyone else's, with attribution.",
        "Can you scope it? Start read-only, or scoped to one workspace, until you trust the pattern. Revoking an API key should be one click.",
        "Does the vendor train on your data? For a self-hosted instance the question is only about your AI client, not the tracker, which is one of the quieter arguments for self-hosting.",
      ],
    },
  ],
  faq: [
    {
      question: "Does Kaneo have an MCP server?",
      answer:
        "Yes. @kaneo/mcp is published on npm for stdio clients, and Kaneo instances also expose MCP over HTTP. Both authenticate with an API key created in workspace settings, so the agent inherits that user's permissions.",
    },
    {
      question: "Which project management tools support MCP?",
      answer:
        "Kaneo ships an official MCP server. Several larger vendors including Linear and Atlassian have released MCP endpoints for their cloud products, and community servers exist for others. Support changes quickly, so check the vendor's own documentation.",
    },
    {
      question: "Is it safe to give an AI agent access to my project tracker?",
      answer:
        "It is as safe as the credential you give it. Use a per-user API key rather than an admin token, start with a single workspace, make sure changes are attributed in activity history, and keep revocation easy.",
    },
    {
      question: "Can I use MCP with a self-hosted instance?",
      answer:
        "Yes. Both the stdio package and the HTTP endpoint work against a self-hosted Kaneo instance. Nothing has to route through a vendor cloud.",
    },
  ],
  related: [
    { label: "MCP documentation", href: "/docs/core/integrations/mcp" },
    { label: "Kaneo vs Linear", href: "/linear-alternative" },
    { label: "All comparisons", href: "/alternatives" },
  ],
  updatedOn: "2026-08-19",
};
