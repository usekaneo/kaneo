import { Effect, Layer } from "effect";
import { HttpClient, HttpClientResponse } from "effect/http";
import { describe, expect, it } from "vite-plus/test";
import type { Environment } from "../render/capabilities.js";
import { CliEnvironment } from "../services/cli-environment.js";
import { captureOutput, testSession } from "../testing/test-layers.js";
import { pngBytes, solid } from "./image-fixtures.js";
import { showImages } from "./render-images.js";

const stream = { isTTY: true, columns: 80 };

function run(
  env: Environment,
  options: { readonly mode?: "json" | "human"; readonly max?: number } = {},
) {
  const requested: string[] = [];
  const output = captureOutput(options.mode ?? "human");
  const client = Layer.succeed(
    HttpClient.HttpClient,
    HttpClient.make((request, url) => {
      requested.push(url.toString());
      const body = url.pathname.endsWith("/missing")
        ? new Response("", { status: 404 })
        : new Response(pngBytes(2, 2, solid(2, 2, [0, 128, 0, 255])), {
            headers: { "content-type": "image/png" },
          });
      return Effect.succeed(HttpClientResponse.fromWeb(request, body));
    }),
  );
  const environment = Layer.succeed(CliEnvironment, {
    env,
    cwd: "/",
    home: "/",
    platform: "darwin",
    stdin: stream,
    stdout: stream,
    stderr: stream,
  });
  const images = [
    { url: "/api/asset/a1", alt: "Login page" },
    { url: "/api/asset/missing", alt: "Gone" },
    { url: "https://cdn.test/c.png", alt: "" },
  ];
  return Effect.runPromise(
    showImages(images, { max: options.max }).pipe(
      Effect.provide(
        Layer.mergeAll(client, environment, output.layer, testSession()),
      ),
    ),
  ).then(() => ({ text: output.stdout.join(""), requested }));
}

describe("showImages", () => {
  it("draws each image with its caption, and placeholders for failures", async () => {
    const { text, requested } = await run({ KANEO_IMAGES: "blocks" });
    expect(requested).toEqual([
      "https://kaneo.test/api/asset/a1",
      "https://kaneo.test/api/asset/missing",
      "https://cdn.test/c.png",
    ]);
    const green = "\u001b[38;2;0;128;0;48;2;0;128;0m▀▀\u001b[39;49m";
    expect(text).toBe(
      [
        `  ${green}`,
        "  Login page",
        "",
        "  [image: Gone] · not found",
        "",
        `  ${green}`,
        "  Image",
        "",
        "",
      ].join("\n"),
    );
  });

  it("lists links when the terminal cannot show images", async () => {
    const { text, requested } = await run({ KANEO_IMAGES: "off" }, { max: 2 });
    expect(requested).toEqual([]);
    expect(text).toBe(
      [
        "  1. Login page",
        "     https://kaneo.test/api/asset/a1",
        "  2. Gone",
        "     https://kaneo.test/api/asset/missing",
        "  1 more image not shown",
        "",
        "",
      ].join("\n"),
    );
  });

  it("prints nothing in JSON mode", async () => {
    const { text, requested } = await run(
      { KANEO_IMAGES: "blocks" },
      { mode: "json" },
    );
    expect(text).toBe("");
    expect(requested).toEqual([]);
  });
});
