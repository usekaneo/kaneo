import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { createOpenRouter } from "../../apps/api/node_modules/@openrouter/ai-sdk-provider";
import { eq } from "drizzle-orm";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  expect,
  it,
  vi,
} from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { meteredModel } from "../../apps/api/src/billing/ai/metered-model";
import { reconcileAiCredit } from "../../apps/api/src/billing/ai/reconcile";
import { readWallet } from "../../apps/api/src/billing/ai/wallet";
import { resetTestDatabase } from "./helpers/database";
import { createWorkspaceMember } from "./helpers/fixtures";

let server: Server;
let address: string;
let workspaceId: string;
let status: number;
let includeCost: boolean;
let generationAvailable: boolean;
let inferences: number;
let generationRequests: number;
const realFetch = globalThis.fetch;

beforeAll(async () => {
  server = createServer(async (req, res) => {
    const url = new URL(req.url!, "http://fixture");
    if (url.pathname === "/api/v1/models") {
      res.setHeader("content-type", "application/json");
      res.end(
        JSON.stringify({
          data: [
            {
              id: "fixture/model",
              context_length: 1000,
              pricing: { prompt: "0.000001", completion: "0.000001" },
            },
          ],
        }),
      );
      return;
    }
    if (url.pathname === "/api/v1/generation") {
      generationRequests++;
      res.setHeader("content-type", "application/json");
      res.statusCode = generationAvailable ? 200 : 404;
      res.end(
        JSON.stringify({
          data: {
            id: url.searchParams.get("id"),
            total_cost: 0.02,
            generation_time: 1,
          },
        }),
      );
      return;
    }
    if (url.pathname !== "/api/v1/chat/completions") {
      res.statusCode = 404;
      res.end();
      return;
    }
    inferences++;
    // The request reaches a real socket only after credit has been reserved.
    expect(
      BigInt((await readWallet(workspaceId)).reservedMicroUsd),
    ).toBeGreaterThan(0n);
    expect(req.headers.authorization).toBe("Bearer local-fixture-key");
    const body: Buffer[] = [];
    for await (const chunk of req) body.push(chunk);
    const sent = JSON.parse(Buffer.concat(body).toString());
    expect(sent.provider).toMatchObject({
      require_parameters: true,
      data_collection: "deny",
      zdr: true,
    });
    expect(sent.user).toBeTruthy();
    res.statusCode = status;
    if (status !== 200) {
      res.setHeader("content-type", "application/json");
      res.end(
        JSON.stringify({
          error: { code: status, message: "Synthetic provider rejection" },
        }),
      );
      return;
    }
    res.setHeader("content-type", "text/event-stream");
    const base = {
      id: "gen-fixture",
      object: "chat.completion.chunk",
      created: 1,
      model: "fixture/model",
    };
    res.write(
      `data: ${JSON.stringify({ ...base, choices: [{ index: 0, delta: { content: "Synthetic response" }, finish_reason: null }] })}\n\n`,
    );
    res.end(
      `data: ${JSON.stringify({ ...base, choices: [{ index: 0, delta: {}, finish_reason: "stop" }], usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2, ...(includeCost ? { cost: 0.01 } : {}) } })}\n\ndata: [DONE]\n\n`,
    );
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  address = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
});
beforeEach(async () => {
  await resetTestDatabase();
  status = 200;
  includeCost = true;
  generationAvailable = true;
  inferences = 0;
  generationRequests = 0;
  vi.stubEnv("KANEO_CLOUD", "true");
  vi.stubEnv("KANEO_AI_PRICE_MULTIPLIER_BPS", "15000");
  vi.stubEnv("OPENROUTER_API_KEY", "local-fixture-key");
  vi.stubEnv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1");
  // Only the transport destination changes. Both SDK decoding and application
  // accounting execute normally against a real local HTTP/SSE server and DB.
  vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url,
    );
    if (url.origin !== "https://openrouter.ai")
      throw new Error("External network disabled in billing fixture");
    return realFetch(`${address}${url.pathname}${url.search}`, init);
  });
  workspaceId = (await createWorkspaceMember({ role: "owner" })).workspace.id;
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

async function stream() {
  const model = await meteredModel(
    createOpenRouter({ apiKey: "local-fixture-key" })("fixture/model"),
    {
      workspaceId,
      runId: "local-run",
      model: "openrouter:fixture/model",
      maxOutputTokens: 256,
      settings: {
        apiKey: "local-fixture-key",
        baseURL: "https://openrouter.ai/api/v1",
      },
    },
  );
  if (typeof model === "string") throw new Error("Expected explicit model");
  const result = await model.doStream({ prompt: [] });
  for await (const _chunk of result.stream) {
    /* drain terminal accounting */
  }
}

it("reserves before a real HTTP request and settles actual adapter SSE cost exactly once", async () => {
  await stream();
  expect(inferences).toBe(1);
  expect(await readWallet(workspaceId)).toMatchObject({
    balanceMicroUsd: "985000",
    reservedMicroUsd: "0",
  });
  const [reservation] = await db.select().from(schema.aiReservationTable);
  expect(reservation).toMatchObject({
    status: "settled",
    generationId: "gen-fixture",
  });
  expect(
    (await db.select().from(schema.aiLedgerTable)).filter(
      (row) => row.kind === "usage",
    ),
  ).toHaveLength(1);
});

it("keeps missing SSE accounting reserved until a later generation lookup succeeds", async () => {
  includeCost = false;
  await expect(stream()).rejects.toThrow("pending reconciliation");
  const [reservation] = await db.select().from(schema.aiReservationTable);
  expect(reservation).toMatchObject({
    status: "held",
    generationId: "gen-fixture",
  });
  const now = new Date(Date.now() + 700000);
  await db
    .update(schema.aiReservationTable)
    .set({
      createdAt: new Date(now.getTime() - 700000),
      nextReconcileAt: new Date(0),
    })
    .where(eq(schema.aiReservationTable.id, reservation!.id));
  generationAvailable = false;
  await reconcileAiCredit(now);
  expect(
    BigInt((await readWallet(workspaceId)).reservedMicroUsd),
  ).toBeGreaterThan(0n);
  generationAvailable = true;
  await reconcileAiCredit(new Date(now.getTime() + 60001));
  expect(await readWallet(workspaceId)).toMatchObject({
    balanceMicroUsd: "970000",
    reservedMicroUsd: "0",
  });
  await reconcileAiCredit(new Date(now.getTime() + 120002));
  expect(generationRequests).toBe(2);
  expect(
    (await db.select().from(schema.aiLedgerTable)).filter(
      (row) => row.kind === "usage",
    ),
  ).toHaveLength(1);
});

it.each([401, 402, 429])(
  "releases actual DB reservations after provider HTTP %s",
  async (code) => {
    status = code;
    await expect(stream()).rejects.toMatchObject({ statusCode: code });
    expect(await readWallet(workspaceId)).toMatchObject({
      balanceMicroUsd: "1000000",
      reservedMicroUsd: "0",
    });
    expect((await db.select().from(schema.aiReservationTable))[0]?.status).toBe(
      "settled",
    );
  },
);

it("retains the reservation after an HTTP 500 with unknown provider cost", async () => {
  status = 500;
  await expect(stream()).rejects.toMatchObject({ statusCode: 500 });
  expect(
    BigInt((await readWallet(workspaceId)).reservedMicroUsd),
  ).toBeGreaterThan(0n);
  expect((await db.select().from(schema.aiReservationTable))[0]?.status).toBe(
    "held",
  );
});
