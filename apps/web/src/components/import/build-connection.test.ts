import { describe, expect, it } from "vite-plus/test";
import { buildConnection } from "@/components/import/build-connection";
import {
  EMPTY_CONNECT_VALUES,
  type ImportConnectValues,
} from "@/components/import/connect-values";

function values(patch: Partial<ImportConnectValues>): ImportConnectValues {
  return { ...EMPTY_CONNECT_VALUES, ...patch };
}

const withServerKey = { serverHasTrelloKey: true };
const withoutServerKey = { serverHasTrelloKey: false };

describe("buildConnection", () => {
  it("trims a Linear key and waits until one is typed", () => {
    expect(
      buildConnection("linear", values({ apiKey: "  " }), withServerKey),
    ).toBeNull();
    expect(
      buildConnection(
        "linear",
        values({ apiKey: " lin_api_1 ", url: "ignored" }),
        withServerKey,
      ),
    ).toEqual({ source: "linear", apiKey: "lin_api_1" });
  });

  it("leaves the Trello key to the server when it has one", () => {
    expect(
      buildConnection(
        "trello",
        values({ token: " tok ", apiKey: "typed" }),
        withServerKey,
      ),
    ).toEqual({ source: "trello", token: "tok" });
  });

  it("needs the user's Trello key when the server has none", () => {
    expect(
      buildConnection("trello", values({ token: "tok" }), withoutServerKey),
    ).toBeNull();
    expect(
      buildConnection(
        "trello",
        values({ token: "tok", apiKey: " key " }),
        withoutServerKey,
      ),
    ).toEqual({ source: "trello", token: "tok", apiKey: "key" });
    expect(
      buildConnection("trello", values({ apiKey: "key" }), withoutServerKey),
    ).toBeNull();
  });

  it("needs both the Plane URL and token", () => {
    expect(
      buildConnection(
        "plane",
        values({ apiKey: "plane_api_1" }),
        withServerKey,
      ),
    ).toBeNull();
    expect(
      buildConnection(
        "plane",
        values({ url: " https://app.plane.so/acme ", apiKey: "plane_api_1" }),
        withServerKey,
      ),
    ).toEqual({
      source: "plane",
      url: "https://app.plane.so/acme",
      apiKey: "plane_api_1",
    });
  });

  it("sends only the PLANKA sign-in the user picked", () => {
    const filled = values({
      url: "https://planka.example.com",
      apiKey: "key",
      username: " ana@example.com ",
      password: " secret ",
    });

    expect(buildConnection("planka", filled, withServerKey)).toEqual({
      source: "planka",
      url: "https://planka.example.com",
      apiKey: "key",
    });
    expect(
      buildConnection(
        "planka",
        { ...filled, plankaSignIn: "password" },
        withServerKey,
      ),
    ).toEqual({
      source: "planka",
      url: "https://planka.example.com",
      username: "ana@example.com",
      password: " secret ",
    });
    expect(
      buildConnection(
        "planka",
        values({
          url: "https://planka.example.com",
          username: "ana",
          plankaSignIn: "password",
        }),
        withServerKey,
      ),
    ).toBeNull();
  });

  it("needs both the Kaneo URL and API key", () => {
    expect(
      buildConnection(
        "kaneo",
        values({ url: "https://cloud.kaneo.app" }),
        withServerKey,
      ),
    ).toBeNull();
    expect(
      buildConnection(
        "kaneo",
        values({ url: "https://cloud.kaneo.app", apiKey: "kaneo_1" }),
        withServerKey,
      ),
    ).toEqual({
      source: "kaneo",
      url: "https://cloud.kaneo.app",
      apiKey: "kaneo_1",
    });
  });
});
