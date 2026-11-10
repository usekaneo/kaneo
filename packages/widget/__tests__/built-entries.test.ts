// @vitest-environment node
import { beforeAll, expect, it } from "vite-plus/test";
import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Window } from "happy-dom";

const cwd = fileURLToPath(new URL("..", import.meta.url));
beforeAll(() => {
  execFileSync("pnpm", ["build"], { cwd, stdio: "pipe" });
});

it("published declarations typecheck ESM and CommonJS consumers", () => {
  execFileSync(
    "pnpm",
    [
      "exec",
      "tsc",
      "--ignoreConfig",
      "--noEmit",
      "--strict",
      "--target",
      "ES2020",
      "--module",
      "nodenext",
      "--moduleResolution",
      "nodenext",
      "__tests__/fixtures/consumer.mts",
      "__tests__/fixtures/consumer.cts",
    ],
    { cwd, stdio: "inherit" },
  );
});

it("built IIFE replays its queue and preserves explicit init over baked defaults", async () => {
  const browser = new Window({
    url: "https://host.example.com",
    settings: { navigation: { disableChildFrameNavigation: true } },
  });
  try {
    browser.eval(`
      window.fetch=async()=>({ok:true,json:async()=>({})});
      window.__QUACKBACK_URL__='https://baked.example.com';
      window.__QUACKBACK_CONFIG__={};
      window.Quackback=function(){(window.Quackback.q??=[]).push(arguments)};
      Quackback('init',{instanceUrl:'https://explicit.example.com',launcher:false,placement:'left'});
      Quackback('metadata',{page:'queue-replay'});
      Quackback('open',{articleId:'article_saved'});
    `);
    browser.eval(
      readFileSync(new URL("../dist/browser.js", import.meta.url), "utf8"),
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(browser.document.querySelector(".quackback-launcher")).toBeNull();
    expect(browser.document.querySelectorAll("iframe")).toHaveLength(1);
    expect(browser.document.querySelector("iframe")?.src).toBe(
      "https://explicit.example.com/widget?showClose=1",
    );
    expect(
      browser.document
        .querySelector(".quackback-panel")
        ?.classList.contains("quackback-open"),
    ).toBe(true);
    expect(
      browser.document.getElementById("quackback-widget-styles")?.textContent,
    ).toContain("left:16px");
    browser.eval("Quackback('destroy')");
    expect(browser.document.querySelector("iframe")).toBeNull();
  } finally {
    await browser.happyDOM.close();
  }
});

it("built ESM and CommonJS entries share their singleton with React", () => {
  const output = execFileSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      `
    import {createRequire} from 'node:module';
    import assert from 'node:assert/strict';
    const require=createRequire(import.meta.url);
    const esm=await import('@quackback/widget');
    const esmReact=await import('@quackback/widget/react');
    const cjs=require('@quackback/widget');
    const cjsReact=require('@quackback/widget/react');
    assert.equal(esm.default,esm.Quackback);
    assert.equal(cjs.default,cjs.Quackback);
    assert.equal(esm.Quackback,esmReact.useQuackback());
    assert.equal(cjs.Quackback,cjsReact.useQuackback());
    assert.equal(cjs.Quackback,cjsReact.Quackback);
    assert.equal(esm.Quackback,esmReact.Quackback);
    assert.equal((await import('@quackback/widget/version')).SDK_VERSION,esm.SDK_VERSION);
    assert.equal(require('@quackback/widget/version').SDK_VERSION,cjs.SDK_VERSION);
    assert.equal(typeof (await import('@quackback/widget/ui')).WidgetView,'function');
    assert.equal(typeof require('@quackback/widget/ui').WidgetView,'function');
    console.log('shared');
  `,
    ],
    { cwd, encoding: "utf8" },
  );
  expect(output.trim()).toBe("shared");
});

it("root and version entries import without React or browser globals", () => {
  execFileSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      `
    import {createRequire,registerHooks} from 'node:module';
    import assert from 'node:assert/strict';
    registerHooks({resolve(specifier,context,next){
      if(specifier==='react'||specifier.startsWith('react/'))throw new Error('React must stay optional');
      return next(specifier,context);
    }});
    const require=createRequire(import.meta.url);
    assert.equal(typeof window,'undefined');
    assert.equal(typeof document,'undefined');
    for(const name of ['@quackback/widget','@quackback/widget/version']) {await import(name);require(name)}
  `,
    ],
    { cwd, stdio: "pipe" },
  );
});

it("emits every declared runtime and declaration entry and a standalone IIFE", () => {
  const manifest = JSON.parse(
    readFileSync(new URL("../package.json", import.meta.url), "utf8"),
  );
  for (const entry of Object.values(manifest.exports)) {
    const files =
      typeof entry === "string"
        ? [entry]
        : Object.values(entry as Record<string, string>);
    for (const file of files)
      expect(existsSync(new URL("../" + file, import.meta.url)), file).toBe(
        true,
      );
  }
  const browser = readFileSync(
    new URL("../dist/browser.js", import.meta.url),
    "utf8",
  );
  expect(browser).toContain("QuackbackBundle");
  expect(browser).not.toMatch(/require\(['"](?:react|zod)/);
});
