import { describe, expect, it } from "vite-plus/test";
import {
  emptyConfig,
  parseConfig,
  serializeConfig,
  withProfile,
} from "./format.js";

describe("parseConfig", () => {
  it("reads the official format", () => {
    const config = withProfile(emptyConfig, "default", () => ({
      apiUrl: "https://cloud.kaneo.app",
      token: "secret",
    }));
    expect(parseConfig(serializeConfig(config))).toEqual({
      status: "ok",
      config,
    });
  });

  it("treats other formats as foreign", () => {
    expect(parseConfig('{"apiKey":"x","workspace":"y"}')).toEqual({
      status: "foreign",
    });
    expect(parseConfig("api_key = x")).toEqual({ status: "foreign" });
    expect(parseConfig("[]")).toEqual({ status: "foreign" });
  });

  it("reports a broken official file as invalid", () => {
    const parsed = parseConfig(
      '{"kind":"kaneo-cli","version":1,"profiles":{}}',
    );
    expect(parsed.status).toBe("invalid");
  });
});

describe("withProfile", () => {
  it("updates one profile and makes it active", () => {
    const first = withProfile(emptyConfig, "work", () => ({
      apiUrl: "https://a.test",
    }));
    const second = withProfile(first, "home", () => ({
      apiUrl: "https://b.test",
    }));
    expect(second.activeProfile).toBe("home");
    expect(Object.keys(second.profiles)).toEqual(["work", "home"]);
  });
});
