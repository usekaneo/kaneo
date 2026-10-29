import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";

const mocks = vi.hoisted(() => ({
  verifyLogoutToken: vi.fn(),
  endProviderSessions: vi.fn(),
  getProviderMetadata: vi.fn(),
}));

vi.mock(
  "../../../apps/api/src/backchannel-logout/verify-logout-token",
  async (importOriginal) => ({
    ...(await importOriginal<object>()),
    verifyLogoutToken: mocks.verifyLogoutToken,
  }),
);

vi.mock(
  "../../../apps/api/src/backchannel-logout/controllers/end-provider-sessions",
  () => ({ endProviderSessions: mocks.endProviderSessions }),
);

vi.mock("../../../apps/api/src/backchannel-logout/provider-metadata", () => ({
  getProviderMetadata: mocks.getProviderMetadata,
}));

import {
  handleBackchannelLogoutRoute,
  MAX_LOGOUT_REQUEST_BYTES,
  noStore,
} from "../../../apps/api/src/backchannel-logout";
import {
  LogoutProviderUnavailable,
  LogoutTokenRejected,
} from "../../../apps/api/src/backchannel-logout/errors";
import { httpExceptionResponse } from "../../../apps/api/src/errors/http-exception-response";
import { boundedRequestBody } from "../../../apps/api/src/utils/bounded-request-body";

const DISCOVERY_URL =
  "https://idp.example.com/realms/kaneo/.well-known/openid-configuration";
const TOKEN = "eyJhbGciOiJSUzI1NiJ9.eyJqdGkiOiJsb2dvdXQtMSJ9.c2lnbmF0dXJl";
const CLAIMS = {
  iss: "https://idp.example.com/realms/kaneo",
  jti: "logout-1",
  iat: 1_792_315_200,
  sid: "kc-session-1",
  sub: "kc-user-1",
};

const app = new Hono();
app.onError((error) =>
  httpExceptionResponse(
    error instanceof HTTPException
      ? error
      : new HTTPException(500, { message: "Internal Server Error" }),
  ),
);
app.post(
  "/logout",
  noStore,
  boundedRequestBody(MAX_LOGOUT_REQUEST_BYTES),
  handleBackchannelLogoutRoute,
);

function postForm(
  body: string | URLSearchParams,
  contentType = "application/x-www-form-urlencoded",
) {
  return app.request("/logout", {
    method: "POST",
    headers: { "content-type": contentType },
    body,
  });
}

function postToken(token = TOKEN) {
  return postForm(new URLSearchParams({ logout_token: token }));
}

async function expectAnswer(
  response: Response,
  status: number,
  body?: unknown,
) {
  expect(response.status).toBe(status);
  expect(response.headers.get("cache-control")).toBe("no-store");
  if (body !== undefined) expect(await response.json()).toEqual(body);
}

beforeEach(() => {
  vi.stubEnv("CUSTOM_OAUTH_BACKCHANNEL_LOGOUT", "true");
  vi.stubEnv("CUSTOM_OAUTH_DISCOVERY_URL", DISCOVERY_URL);
  vi.stubEnv("CUSTOM_OAUTH_CLIENT_ID", "kaneo-test");
  mocks.verifyLogoutToken.mockResolvedValue(CLAIMS);
  mocks.endProviderSessions.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetAllMocks();
  vi.restoreAllMocks();
});

describe("back-channel logout route", () => {
  it("ends the provider sessions of a valid logout token", async () => {
    const response = await postToken();

    await expectAnswer(response, 200);
    expect(await response.text()).toBe("");
    expect(mocks.verifyLogoutToken).toHaveBeenCalledWith(
      TOKEN,
      "kaneo-test",
      expect.any(Function),
    );
    expect(mocks.endProviderSessions).toHaveBeenCalledWith(CLAIMS);
  });

  it("loads the issuer, algorithms and keys from the discovery document", async () => {
    mocks.getProviderMetadata.mockResolvedValue({
      issuer: CLAIMS.iss,
      jwksUri: `${CLAIMS.iss}/protocol/openid-connect/certs`,
      algorithms: ["RS256"],
    });
    await postToken();

    const loadProvider = mocks.verifyLogoutToken.mock.calls[0]?.[2] as
      | (() => Promise<unknown>)
      | undefined;
    await expect(loadProvider?.()).resolves.toEqual({
      issuer: CLAIMS.iss,
      algorithms: ["RS256"],
      jwksCacheKey: expect.any(Object),
      jwksFetch: expect.any(Function),
    });
    expect(mocks.getProviderMetadata).toHaveBeenCalledWith(DISCOVERY_URL);
  });

  it("accepts a form content type with a charset", async () => {
    await expectAnswer(
      await postForm(
        new URLSearchParams({ logout_token: TOKEN }).toString(),
        "application/x-www-form-urlencoded; charset=UTF-8",
      ),
      200,
    );
  });

  it.each(["", "false"])(
    "answers 404 while back-channel logout is %p",
    async (value) => {
      vi.stubEnv("CUSTOM_OAUTH_BACKCHANNEL_LOGOUT", value);

      await expectAnswer(await postToken(), 404);
      expect(mocks.verifyLogoutToken).not.toHaveBeenCalled();
    },
  );

  it.each([
    [
      "a JSON body",
      JSON.stringify({ logout_token: TOKEN }),
      "application/json",
    ],
    ["no logout_token", "state=1", undefined],
    ["an empty logout_token", "logout_token=", undefined],
    [
      "two logout tokens",
      `logout_token=${TOKEN}&logout_token=${TOKEN}`,
      undefined,
    ],
    ["a logout_token that is no JWS", "logout_token=a.b", undefined],
  ])("rejects %s", async (_name, body, contentType) => {
    await expectAnswer(await postForm(body, contentType), 400, {
      error: "invalid_request",
    });
    expect(mocks.verifyLogoutToken).not.toHaveBeenCalled();
  });

  it("refuses a body over 16 KiB", async () => {
    await expectAnswer(
      await postForm(`logout_token=${"a".repeat(MAX_LOGOUT_REQUEST_BYTES)}`),
      413,
    );
    expect(mocks.verifyLogoutToken).not.toHaveBeenCalled();
  });

  it("answers 503 while the provider's keys cannot be loaded", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    mocks.verifyLogoutToken.mockRejectedValue(
      new LogoutProviderUnavailable(
        "https://idp.example.com could not be reached",
      ),
    );

    await expectAnswer(await postToken(), 503, {
      error: "temporarily_unavailable",
    });
    expect(mocks.endProviderSessions).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledOnce();
  });

  it("rejects a token the verifier refuses without logging it", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    mocks.verifyLogoutToken.mockRejectedValue(
      new LogoutTokenRejected("signature verification failed"),
    );

    await expectAnswer(await postToken(), 400, { error: "invalid_request" });
    expect(mocks.endProviderSessions).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(
      "Rejected a back-channel logout token: signature verification failed",
    );
    expect(JSON.stringify(warn.mock.calls)).not.toContain(TOKEN);
  });

  it("rejects a token that was used before", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    mocks.endProviderSessions.mockRejectedValue(
      new LogoutTokenRejected("the logout token was used before"),
    );

    await expectAnswer(await postToken(), 400, { error: "invalid_request" });
  });

  it("answers 500 when ending the sessions fails", async () => {
    mocks.endProviderSessions.mockRejectedValue(new Error("database down"));

    await expectAnswer(await postToken(), 500);
  });
});
