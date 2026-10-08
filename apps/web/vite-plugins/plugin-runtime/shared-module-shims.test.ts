import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vite-plus/test";
import {
  createImportMap,
  createSharedModuleShim,
  exportableNames,
  sharedModuleFileName,
  sharedModuleUrl,
} from "./shared-module-shims";

const GLOBAL = "__KANEO_SHARED_MODULES__";

describe("sharedModuleFileName", () => {
  it.each([
    ["react", "react.js"],
    ["react/jsx-runtime", "react-jsx-runtime.js"],
    ["react/jsx-dev-runtime", "react-jsx-dev-runtime.js"],
    ["react-dom", "react-dom.js"],
    ["@tanstack/react-query", "tanstack-react-query.js"],
  ])("maps %s to %s", (specifier, fileName) => {
    expect(sharedModuleFileName(specifier)).toBe(fileName);
  });
});

describe("exportableNames", () => {
  it("keeps sorted identifiers and drops default, __esModule and invalid keys", () => {
    expect(
      exportableNames([
        "useState",
        "default",
        "__esModule",
        "Children",
        "not-valid",
        "1abc",
        "delete",
        "$value",
        "useState",
      ]),
    ).toEqual(["$value", "Children", "useState"]);
  });
});

describe("createSharedModuleShim", () => {
  it("re-exports the host module from the shared global", () => {
    const shim = createSharedModuleShim(
      "react",
      ["default", "useEffect", "useState", "__esModule"],
      GLOBAL,
    );

    expect(shim).toEqual({
      specifier: "react",
      fileName: "react.js",
      source: [
        `const m = globalThis.${GLOBAL}["react"];`,
        "export default m.default ?? m;",
        "export const { useEffect, useState } = m;",
        "",
      ].join("\n"),
    });
  });

  it("evaluates to the same values the host installed", () => {
    const host = { default: { marker: true }, useState: () => "state" };
    const shim = createSharedModuleShim("react", Object.keys(host), GLOBAL);
    const script = shim.source
      .replace(
        "export default m.default ?? m;",
        "globalThis.out = m.default ?? m;",
      )
      .replace("export const {", "const {")
      .concat("globalThis.named = { useState };");
    const context: Record<string, unknown> = {
      [GLOBAL]: { react: host },
    };

    runInNewContext(script, context);

    expect(context.out).toBe(host.default);
    expect(context.named).toEqual({ useState: host.useState });
  });

  it("is left untouched by the runtime environment renderer", () => {
    const shim = createSharedModuleShim(
      "@tanstack/react-query",
      ["QueryClient", "useQuery"],
      GLOBAL,
    );
    const rendered = execFileSync(
      "awk",
      [
        "-v",
        "mode=bundle",
        "-f",
        resolve(import.meta.dirname, "../../env.awk"),
      ],
      {
        input: shim.source,
        encoding: "utf8",
        env: {
          ...process.env,
          KANEO_API_URL: "https://api.example.test",
          KANEO_CLIENT_URL: "https://app.example.test",
          KANEO_TURNSTILE_SITE_KEY: "key",
        },
      },
    );

    expect(rendered).toBe(shim.source);
  });
});

describe("createImportMap", () => {
  const shims = [
    { specifier: "react", fileName: "react.js" },
    { specifier: "@tanstack/react-query", fileName: "tanstack-react-query.js" },
  ];

  it("maps each specifier to its shim under the base path", () => {
    expect(createImportMap(shims, "/")).toEqual({
      imports: {
        react: "/plugin-runtime/react.js",
        "@tanstack/react-query": "/plugin-runtime/tanstack-react-query.js",
      },
    });
  });

  it("respects a nested base with or without a trailing slash", () => {
    expect(sharedModuleUrl("/kaneo/", "react.js")).toBe(
      "/kaneo/plugin-runtime/react.js",
    );
    expect(sharedModuleUrl("/kaneo", "react.js")).toBe(
      "/kaneo/plugin-runtime/react.js",
    );
  });
});
