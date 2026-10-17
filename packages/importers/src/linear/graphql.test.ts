import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type { FetchLike } from "../types.js";
import {
  createLinearGraphQL,
  INVALID_API_KEY_MESSAGE,
  RATE_LIMITED_MESSAGE,
} from "./graphql.js";

const API_KEY = "lin_api_secret";

type Reply = {
  status?: number;
  body: unknown;
  headers?: Record<string, string>;
};

function scripted(...replies: Reply[]) {
  const requests: Array<{ url: string; init: RequestInit | undefined }> = [];
  const fetch: FetchLike = async (url, init) => {
    requests.push({ url, init });
    const reply = replies[Math.min(requests.length, replies.length) - 1];
    if (!reply) throw new Error("no reply scripted");
    return new Response(JSON.stringify(reply.body), {
      status: reply.status ?? 200,
      headers: { "Content-Type": "application/json", ...reply.headers },
    });
  };
  return { fetch, requests };
}

const RATE_LIMITED = {
  errors: [
    {
      message: "Rate limit exceeded",
      extensions: { code: "RATELIMITED" },
    },
  ],
};

afterEach(() => {
  vi.useRealTimers();
});

describe("createLinearGraphQL", () => {
  it("posts the query with the raw API key, never as a bearer", async () => {
    const { fetch, requests } = scripted({
      body: { data: { viewer: { id: "u1" } } },
    });
    const graphql = createLinearGraphQL({ apiKey: API_KEY, fetch });

    const data = await graphql<{ viewer: { id: string } }>(
      "query Q { viewer { id } }",
      {
        a: 1,
      },
    );

    expect(data.viewer.id).toBe("u1");
    expect(requests[0]?.url).toBe("https://api.linear.app/graphql");
    expect(requests[0]?.init?.method).toBe("POST");
    const headers = new Headers(requests[0]?.init?.headers);
    expect(headers.get("authorization")).toBe(API_KEY);
    expect(headers.get("content-type")).toBe("application/json");
    expect(JSON.parse(String(requests[0]?.init?.body))).toEqual({
      query: "query Q { viewer { id } }",
      variables: { a: 1 },
    });
  });

  it("surfaces the first GraphQL error message", async () => {
    const { fetch } = scripted({
      body: {
        data: null,
        errors: [{ message: "Field 'nope' is not defined" }],
      },
    });
    await expect(
      createLinearGraphQL({ apiKey: API_KEY, fetch })("query Q { nope }"),
    ).rejects.toThrow("Linear: Field 'nope' is not defined");

    const bad = scripted({
      status: 400,
      body: {
        errors: [
          {
            message: "Variable $teamId is invalid",
            extensions: { code: "INVALID_INPUT" },
          },
        ],
      },
    });
    await expect(
      createLinearGraphQL({ apiKey: API_KEY, fetch: bad.fetch })(
        "query Q { x }",
      ),
    ).rejects.toThrow("Linear: Variable $teamId is invalid");
  });

  it("explains a rejected API key without leaking it", async () => {
    const graphqlAuth = scripted({
      status: 400,
      body: {
        errors: [
          {
            message: "Authentication required, not authenticated",
            extensions: {
              code: "AUTHENTICATION_ERROR",
              type: "authentication error",
            },
          },
        ],
      },
    });
    const httpAuth = scripted({
      status: 401,
      body: { message: "Unauthorized" },
    });

    for (const { fetch } of [graphqlAuth, httpAuth]) {
      const error = await createLinearGraphQL({ apiKey: API_KEY, fetch })(
        "query Q { viewer { id } }",
      ).catch((caught: unknown) => caught as Error);
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe(INVALID_API_KEY_MESSAGE);
      expect((error as Error).message).not.toContain(API_KEY);
    }
  });

  it("waits for the rate limit reset header and retries RATELIMITED responses", async () => {
    vi.useFakeTimers();
    const reset = Date.now() + 5_000;
    const { fetch, requests } = scripted(
      {
        status: 400,
        body: RATE_LIMITED,
        headers: {
          "X-RateLimit-Requests-Reset": String(reset),
          "X-RateLimit-Complexity-Reset": String(Date.now() + 1_000),
        },
      },
      { body: { data: { ok: true } } },
    );

    const pending = createLinearGraphQL({ apiKey: API_KEY, fetch })<{
      ok: boolean;
    }>("query Q { ok }");

    await vi.advanceTimersByTimeAsync(4_900);
    expect(requests).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(200);
    expect(requests).toHaveLength(2);
    await expect(pending).resolves.toEqual({ ok: true });
  });

  it("backs off without headers and gives up with a clear message", async () => {
    vi.useFakeTimers();
    const { fetch, requests } = scripted({ status: 400, body: RATE_LIMITED });

    const pending = createLinearGraphQL({ apiKey: API_KEY, fetch })(
      "query Q { ok }",
    ).catch((caught: unknown) => caught as Error);

    await vi.advanceTimersByTimeAsync(999);
    expect(requests).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(60_000);

    const error = await pending;
    expect(requests).toHaveLength(6);
    expect((error as Error).message).toBe(RATE_LIMITED_MESSAGE);
  });
});
