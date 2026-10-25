import { createServer, type Server } from "node:http";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { postToGenericWebhook } from "../plugins/generic-webhook/client";
import { giteaFetch } from "../plugins/gitea/utils/gitea-api";
import { gitlabFetch } from "../plugins/gitlab/utils/gitlab-api";
import { postToMattermost } from "../plugins/mattermost/client";
import { assertPublicDestination } from "./assert-public-destination";
import { sendOutboundRequest } from "./outbound-request";

const { preflightLookup, connectLookup } = vi.hoisted(() => ({
  preflightLookup: vi.fn(),
  connectLookup: vi.fn(),
}));
vi.mock("node:dns/promises", () => ({ lookup: preflightLookup }));
vi.mock("node:dns", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:dns")>();
  return {
    ...actual,
    default: { ...actual, lookup: connectLookup },
  };
});

let server: Server;
let port: number;
let connections: number;
let host: string | undefined;
let requestedPaths: Array<string | undefined>;
beforeEach(async () => {
  vi.stubEnv("KANEO_ALLOW_PRIVATE_WEBHOOK_DESTINATIONS", "");
  preflightLookup
    .mockReset()
    .mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
  connectLookup
    .mockReset()
    .mockImplementation((_hostname, _options, callback) => {
      callback(null, [{ address: "127.0.0.1", family: 4 }]);
    });
  vi.stubGlobal(
    "fetch",
    vi.fn().mockRejectedValue(new Error("Unexpected fetch")),
  );
  connections = 0;
  host = undefined;
  requestedPaths = [];
  server = createServer((request, response) => {
    host = request.headers.host;
    requestedPaths.push(request.url);
    request.resume();
    if (request.url === "/redirect") {
      response.writeHead(307, { Location: "/target" });
    }
    response.end("{}");
  });
  server.on("connection", () => connections++);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing port");
  port = address.port;
});
afterEach(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("outbound connection destination validation", () => {
  it.each([
    [
      "notification",
      (url: string) =>
        sendOutboundRequest(url, {}, { publicDestination: true }),
    ],
    [
      "generic webhook",
      (url: string) => postToGenericWebhook(url, { title: "Task" }),
    ],
    ["Gitea", (url: string) => giteaFetch(url, "token", "/user")],
    ["GitLab", (url: string) => gitlabFetch(url, "token", "private", "/user")],
    ["Mattermost", (url: string) => postToMattermost(url, { text: "Task" })],
  ] as const)(
    "blocks a private connection answer for %s",
    async (_name, send) => {
      await expect(send(`https://rebind.example:${port}`)).rejects.toThrow();
      expect(preflightLookup).toHaveBeenCalled();
      expect(connectLookup).toHaveBeenCalledWith(
        "rebind.example",
        expect.objectContaining({ all: true }),
        expect.any(Function),
      );
      expect(globalThis.fetch).not.toHaveBeenCalled();
      expect(connections).toBe(0);
    },
  );

  it("preserves the private-service opt-in and original HTTP host", async () => {
    vi.stubEnv("KANEO_ALLOW_PRIVATE_WEBHOOK_DESTINATIONS", "true");
    await sendOutboundRequest(
      `http://internal.example:${port}`,
      { body: "Message" },
      { publicDestination: true },
    );
    expect(host).toBe(`internal.example:${port}`);
    expect(connections).toBe(1);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("accepts a public IPv6 literal without a hostname lookup", async () => {
    await expect(
      assertPublicDestination("https://[2606:4700:4700::1111]", "Test"),
    ).resolves.toBeUndefined();
    expect(preflightLookup).not.toHaveBeenCalled();
  });

  it("keeps the fixed-service transport for requests without a custom destination", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(new Response(null));
    await sendOutboundRequest("https://api.telegram.org/bot/test", {});
    expect(globalThis.fetch).toHaveBeenCalledOnce();
    expect(connectLookup).not.toHaveBeenCalled();
  });

  it("does not follow redirects through the guarded transport", async () => {
    vi.stubEnv("KANEO_ALLOW_PRIVATE_WEBHOOK_DESTINATIONS", "true");
    await expect(
      sendOutboundRequest(
        `http://redirect.example:${port}/redirect`,
        { body: "Message", headers: { Authorization: "Bearer token" } },
        { publicDestination: true },
      ),
    ).rejects.toMatchObject({ reason: "network" });
    expect(requestedPaths).toEqual(["/redirect"]);
  });
});
