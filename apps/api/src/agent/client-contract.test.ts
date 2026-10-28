import { hc } from "hono/client";
import { expect, it, vi } from "vite-plus/test";
import type { AppType } from "../index";

it("exposes the agent endpoints through Kaneo's typed client contract", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValue(
      Response.json({ id: "run", status: "queued" }, { status: 202 }),
    );
  const client = hc<AppType>("http://localhost:1337/api", { fetch });
  const response = await client.agent[":workspaceId"].conversations[
    ":conversationId"
  ].runs.$post({
    param: { workspaceId: "workspace", conversationId: "conversation" },
    json: {
      requestId: "ac69d55b-fb53-48b5-94ce-bfd07b2c7c75",
      prompt: "Plan the week",
    },
  });
  expect(response.status).toBe(202);
  expect(fetch.mock.calls[0]?.[0]).toBe(
    "http://localhost:1337/api/agent/workspace/conversations/conversation/runs",
  );
});

it("exposes attachment uploads and content through the typed client", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValue(
      Response.json(
        { id: "a1", name: "shot.png", mediaType: "image/png", size: 3 },
        { status: 201 },
      ),
    );
  const client = hc<AppType>("http://localhost:1337/api", { fetch });
  const attachments = client.agent[":workspaceId"].attachments;
  const response = await attachments.$post({
    param: { workspaceId: "workspace" },
    json: { name: "shot.png", mediaType: "image/png", data: "iVBO" },
  });
  expect(response.status).toBe(201);
  expect(fetch.mock.calls[0]?.[0]).toBe(
    "http://localhost:1337/api/agent/workspace/attachments",
  );
  expect(
    attachments[":attachmentId"].content
      .$url({ param: { workspaceId: "workspace", attachmentId: "a1" } })
      .toString(),
  ).toBe("http://localhost:1337/api/agent/workspace/attachments/a1/content");
});
