/* eslint-disable no-template-curly-in-string -- Parser fixtures contain literal template syntax. */
import assert from "node:assert/strict";
import { mkdtemp, writeFile, readFile, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  brand,
  brandResources,
  brandText,
  instanceName,
  brandAssetUrl,
  missingTranslation,
} from "../../branding/index.cjs";
import {
  scanCode,
  scanText,
  scanStyles,
  checkOutput,
  validateReleaseConfig,
  sourceFindings,
  exceptionValue,
} from "./check.mjs";
import { root, safePath, digest } from "./assets.mjs";
import { transformCopy } from "./source.mjs";
import { packageMetadata, registryMetadata } from "./prepare-package.mjs";
import { vendorBrand } from "./vendor.mjs";
import { prepareDocs } from "./prepare.mjs";
import { packageOutput } from "./package-output.mjs";
import { brandInstaller } from "./installer.mjs";
import { brandHtml } from "./html.mjs";
import { execFileSync } from "node:child_process";

test("catalog values change while keys, interpolation and input remain intact", () => {
  const input = {
    useKaneo: "Kaneo welcomes {{KaneoUser}}",
    list: ["KANEO", "https://kaneo.app/docs/start"],
  };
  assert.deepEqual(brandResources(input), {
    useKaneo: `${brand.name} welcomes {{KaneoUser}}`,
    list: [brand.name, `${brand.docsUrl}/start`],
  });
  assert.equal(input.useKaneo, "Kaneo welcomes {{KaneoUser}}");
});

test("instance fallback preserves custom names and handles old default", () => {
  for (const value of [null, undefined, "", " Kaneo ", "kaneo"])
    assert.equal(instanceName(value), brand.name);
  assert.equal(instanceName("  Team  "), "Team");
  assert.equal(brandText("KANEO_CLIENT_URL"), "KANEO_CLIENT_URL");
});

test("reviewed URL references stay valid when public and client origins match", () => {
  const original = brand.clientUrl;
  try {
    brand.clientUrl = brand.publicUrl;
    assert.equal(
      exceptionValue("default {{clientUrl}}"),
      exceptionValue(`default ${brand.publicUrl}`),
    );
    assert.equal(
      exceptionValue("host {{clientUrlHost}}"),
      exceptionValue(`host ${new URL(brand.publicUrl).host}`),
    );
    brand.clientUrl = "https://separate-client.example.invalid";
    assert.equal(exceptionValue(brand.clientUrl), "{{clientUrl}}");
    assert.notEqual(
      exceptionValue(brand.clientUrl),
      exceptionValue(brand.publicUrl),
    );
  } finally {
    brand.clientUrl = original;
  }
});

test("imports cannot hide visible text on the same line", () => {
  const findings = scanCode(
    'import x from "@kaneo/libs"; const label = "Kaneo";',
    "example.ts",
  );
  assert.equal(findings.length, 1);
  assert.equal(findings[0].term, "Kaneo");
  assert.equal(
    scanCode(
      'import { brandText } from "@kaneo/branding"; const label = brandText("Kaneo");',
      "example.ts",
    ).length,
    0,
  );
  assert.throws(() => scanCode("const =", "example.ts"));
});

test("matching covers case, domains and requested spelling variants", () => {
  for (const term of [
    "kAnEo",
    "Caneo",
    "Kenya",
    "https://assets.kaneo.app/a.png",
  ])
    assert.equal(scanText(term, "example.html").length, 1);
  assert.equal(scanText("@kaneo/libs", "example.html").length, 0);
  assert.equal(scanText("@kenya/libs", "example.html").length, 0);
  assert.deepEqual(
    scanText("@kenya/libs welcomes Kenya", "example.html").map(
      (item) => item.term,
    ),
    ["Kenya"],
  );
  assert.equal(
    scanText("<h1>kaneo task manager</h1>", "example.html").length,
    1,
  );
});

test("unrelated, shadowed adapters and missing translation keys cannot hide copy", () => {
  assert.equal(
    scanCode(
      'function brandText(x) { return x; } const label = brandText("Kaneo");',
      "example.ts",
    ).length,
    1,
  );
  assert.equal(
    scanCode('const label = t("Welcome to Kaneo");', "example.ts").length,
    1,
  );
  assert.equal(
    scanCode(
      'import {brandText} from "@kaneo/branding"; function label(brandText) { return brandText("Kaneo"); }',
      "example.ts",
    ).length,
    1,
  );
  assert.equal(
    scanCode(
      'import {brandText as copy} from "@kaneo/branding"; const label=copy("Kaneo");',
      "example.ts",
    ).length,
    0,
  );
});

test("site adapter supports configured names with quotes and ampersands", () => {
  const name = brand.name;
  try {
    brand.name = 'Acme "Planner" & Team';
    const output = transformCopy(
      'const x=<span title="Kaneo">Kaneo</span>;',
      "example.tsx",
    );
    assert.equal(scanCode(output, "example.tsx").length, 0);
    assert.ok(output.includes('title={"Acme \\"Planner\\" & Team"}'));
    assert.ok(output.includes("&amp;"));
  } finally {
    brand.name = name;
  }
});

test("site adapter preserves imports and keys and safely escapes templates", () => {
  const input =
    'import x from "@kaneo/libs"; const copy = { "useKaneo": "Kaneo" }; const y = `Kaneo ${name}`; const z = <span title="Kaneo">Kaneo</span>;';
  const output = transformCopy(input, "example.tsx");
  assert.match(output, /"@kaneo\/libs"/);
  assert.match(output, /"useKaneo"/);
  assert.ok(output.includes(`title={"${brand.name}"}`));
  assert.equal(scanCode(output, "example.tsx").length, 0);
});

test("asset paths cannot escape and hashes detect changes", () => {
  assert.throws(() => safePath(root, "../outside"));
  assert.notEqual(digest("original"), digest("changed"));
});

test("docs preparation writes branded output without copy findings", async () => {
  await mkdir(path.join(root, ".cache"), { recursive: true });
  const output = await mkdtemp(path.join(root, ".cache/branded-docs-test-"));
  try {
    await assert.rejects(prepareDocs(path.join(root, ".cache")), /escapes/);
    await prepareDocs(output);
    const config = JSON.parse(
      await readFile(path.join(output, "docs.json"), "utf8"),
    );
    assert.equal(config.name, brand.name);
    assert.equal(config.analytics, undefined);
    assert.equal(config.integrations?.plausible, undefined);
  } finally {
    await rm(output, { recursive: true, force: true });
  }
});

test("output packaging blocks leftover copy and unapproved artwork", async () => {
  const dir = await mkdtemp(path.join(root, ".cache-branding-test-"));
  try {
    const relative = path.relative(root, dir);
    await writeFile(path.join(dir, "index.html"), "<title>Kaneo</title>");
    await writeFile(
      path.join(dir, "unknown-logo.png"),
      "unapproved image bytes",
    );
    await assert.rejects(
      packageOutput("apps/web/public", relative),
      (error) =>
        /index\.html:1: text: Kaneo/.test(error.message) &&
        /unknown-logo\.png:1: unapproved-output-asset/.test(error.message),
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("output packaging replaces only an identical renamed asset", async () => {
  const dir = await mkdtemp(path.join(root, ".cache-branding-test-"));
  try {
    const relative = path.relative(root, dir);
    await writeFile(path.join(dir, "kaneo-kit.txt"), "same");
    await writeFile(path.join(dir, "product-kit.txt"), "same");
    await packageOutput("apps/web/public", relative);
    await assert.rejects(readFile(path.join(dir, "kaneo-kit.txt")), {
      code: "ENOENT",
    });
    assert.equal(
      await readFile(path.join(dir, "product-kit.txt"), "utf8"),
      "same",
    );
    await writeFile(path.join(dir, "kaneo-kit.txt"), "different");
    await assert.rejects(
      packageOutput("apps/web/public", relative),
      /Asset rename collision/,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("bundle checks skip catalog keys and env placeholders but not copy", async () => {
  await mkdir(path.join(root, ".cache/npm"), { recursive: true });
  const dir = await mkdtemp(path.join(root, ".cache/npm/branding-test-"));
  try {
    await writeFile(
      path.join(dir, "app.js"),
      [
        `JSON.parse('{"goToKaneo":"Go to quills","leak":"Try Kaneo"}');`,
        `e("settings:syncRules.useKaneo");`,
        `const url = "KANEO_CLIENT_URL";`,
        `const title = "Kaneo rocks";`,
      ].join("\n"),
    );
    const findings = await checkOutput(path.relative(root, dir));
    assert.deepEqual(findings.map((finding) => finding.value).sort(), [
      "Kaneo rocks",
      'leak: "Try Kaneo"',
    ]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("output checks reject missing, empty, malformed and source-map outputs", async () => {
  const dir = await mkdtemp(path.join(root, ".cache-branding-test-"));
  try {
    const relative = path.relative(root, dir);
    await assert.rejects(checkOutput(relative), /Empty/);
    await assert.rejects(checkOutput(`${relative}/missing`));
    await writeFile(path.join(dir, "index.html"), "<title>Kaneo</title>");
    assert.equal((await checkOutput(relative)).length, 1);
    await writeFile(
      path.join(dir, "unknown-logo.png"),
      "unapproved image bytes",
    );
    assert.equal(
      (await checkOutput(relative)).filter(
        (finding) => finding.rule === "unapproved-output-asset",
      ).length,
      1,
    );
    await writeFile(path.join(dir, "app.js.map"), "{}");
    await assert.rejects(checkOutput(relative), /source map/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("placeholder brand cannot pass the release gate", () => {
  const name = brand.name;
  try {
    brand.name = "PRODUCT_NAME";
    assert.throws(validateReleaseConfig, /approved product name/);
  } finally {
    brand.name = name;
  }
});

test("publication metadata retains package identifiers and licenses without private build dependencies", () => {
  const original = {
    name: "@kaneo/mcp",
    license: "MIT",
    author: "Kaneo",
    description: "Kaneo tools",
    devDependencies: { "@kaneo/branding": "workspace:*" },
    scripts: { prepublishOnly: "build" },
    repository: { type: "git", url: "https://github.com/usekaneo/kaneo" },
  };
  const prepared = packageMetadata(original);
  assert.equal(prepared.name, original.name);
  assert.equal(prepared.license, "MIT");
  assert.equal(prepared.description, `${brand.name} tools`);
  assert.equal(prepared.repository.url, brand.repositoryUrl);
  assert.equal(prepared.author, undefined);
  assert.equal(prepared.scripts, undefined);
  assert.equal(prepared.devDependencies, undefined);
  assert.ok(original.devDependencies);
});

test("unknown hosts and hostname lookalikes require explicit mappings", () => {
  for (const url of [
    "https://plausible.kaneo.app/js",
    "https://kaneo.app.evil/path",
    "https://kaneoXapp/path",
  ])
    assert.equal(brandText(url), url);
});

test("copy adapters preserve technical camel-case identifiers", () => {
  assert.equal(
    brandText("KaneoClient Install-KaneoCli KANEO_CLIENT_URL"),
    "KaneoClient Install-KaneoCli KANEO_CLIENT_URL",
  );
});

test("HTML metadata escapes configured product punctuation", () => {
  const name = brand.name;
  try {
    brand.name = 'Acme "Planner" & Team';
    const output = brandHtml(
      '<title>Kaneo</title><meta name="application-name" content="Kaneo">',
    );
    assert.ok(output.includes('content="Acme &quot;Planner&quot; &amp; Team"'));
  } finally {
    brand.name = name;
  }
});

test("installer branding escapes inserted quotes and variables while retaining function names", () => {
  const name = brand.name;
  try {
    brand.name = 'Bob\'s "$Project" `Plan` & Team';
    const script = brandInstaller(
      "printf '%s\\n' 'Kaneo'; printf '%s\\n' \"Kaneo\";",
      "install.sh",
    );
    assert.equal(
      execFileSync("sh", ["-c", script], { encoding: "utf8" }),
      `${brand.name}\n${brand.name}\n`,
    );
    const powershell = brandInstaller(
      "function Install-KaneoCli { Write-Output 'Kaneo'; Write-Output \"Kaneo\"; }",
      "install.ps1",
    );
    assert.ok(powershell.startsWith("function Install-KaneoCli"));
    assert.ok(powershell.includes("Bob''s"));
    assert.ok(powershell.includes("`$Project"));
  } finally {
    brand.name = name;
  }
});

test("vendored static branding passes artifact validation without the private workspace package", async () => {
  const directory = await mkdtemp(path.join(root, ".cache-branding-vendor-"));
  try {
    await writeFile(path.join(directory, "package.json"), '{"type":"module"}');
    await writeFile(
      path.join(directory, "index.js"),
      'import {brandText as copy} from "@kaneo/branding"; export const label=copy("Kaneo tools");',
    );
    await vendorBrand(path.relative(root, directory));
    assert.deepEqual(await checkOutput(path.relative(root, directory)), []);
    assert.equal(
      (await import(path.join(directory, "index.js"))).label,
      `${brand.name} tools`,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("new non-ignored source files are included in the full source scan", async () => {
  const directory = await mkdtemp(
    path.join(root, "apps/web/src/branding-probe-"),
  );
  try {
    const file = path.join(directory, "new-copy.ts");
    await writeFile(file, 'export const label = "Caneo";');
    assert.ok(
      (await sourceFindings()).some(
        (finding) =>
          finding.file === path.relative(root, file) &&
          finding.term === "Caneo",
      ),
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("styles inspect rendered content and escaped URLs while preserving selectors", () => {
  assert.equal(
    scanStyles(".kaneo { color: red } /* Kaneo */", "example.css").length,
    0,
  );
  assert.equal(
    scanStyles(
      '.x { content: "Kaneo"; background: url(https://k\\61 neo.app/logo.png) }',
      "example.css",
    ).length,
    2,
  );
});

test("approved assets get cache versions and missing translation display keeps brand", () => {
  const asset = {
    source: "test.svg",
    target: "apps/web/public/kaneo-logo.svg",
    sha256: "1234",
    approved: true,
  };
  brand.assets.push(asset);
  try {
    assert.equal(brandAssetUrl(asset.target), "/product-logo.svg?brand=1234");
    assert.equal(brandAssetUrl("apps/web/public/unknown.svg"), undefined);
    assert.equal(
      missingTranslation("common:welcomeToKaneo"),
      `common:welcomeTo${brand.name}`,
    );
  } finally {
    brand.assets.pop();
  }
});

test("publication scopes change published metadata without changing workspace names", () => {
  const scope = brand.npmScope;
  try {
    brand.npmScope = "test-product";
    const original = { name: "@kaneo/mcp" };
    assert.equal(packageMetadata(original).name, "@test-product/mcp");
    assert.equal(original.name, "@kaneo/mcp");
    assert.equal(
      registryMetadata({
        packages: [{ registryType: "npm", identifier: "@kaneo/mcp" }],
      }).packages[0].identifier,
      "@test-product/mcp",
    );
  } finally {
    brand.npmScope = scope;
  }
});

test("original stock art stays forbidden even if supplied as an approved replacement", async () => {
  const directory = await mkdtemp(path.join(root, ".cache-branding-stock-"));
  const inventory = JSON.parse(
    await readFile(path.join(root, "branding/asset-review.json"), "utf8"),
  );
  const [target, entry] = Object.entries(inventory).find(
    ([, item]) => item.requiresReplacement,
  );
  brand.assets.push({
    source: "test.png",
    target,
    sha256: entry.sha256,
    approved: true,
  });
  try {
    await writeFile(
      path.join(directory, path.basename(target)),
      await readFile(path.join(root, target)),
    );
    assert.ok(
      (await checkOutput(path.relative(root, directory))).some(
        (item) => item.rule === "unapproved-output-asset",
      ),
    );
  } finally {
    brand.assets.pop();
    await rm(directory, { recursive: true, force: true });
  }
});

test("compiled artifacts allow exact reviewed identifiers while catching visible product copy", async () => {
  await mkdir(path.join(root, ".cache/npm"), { recursive: true });
  const directory = await mkdtemp(path.join(root, ".cache/npm/mcp-test-"));
  try {
    await writeFile(
      path.join(directory, "index.js"),
      'const id="kaneo-mcp"; const label="Kaneo";',
    );
    const findings = await checkOutput(path.relative(root, directory));
    assert.deepEqual(
      findings.map((item) => item.value),
      ["Kaneo"],
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("upstream attribution is approved only in its reviewed public document", async () => {
  const policy = JSON.parse(
    await readFile(
      path.join(root, "branding/technical-references.json"),
      "utf8",
    ),
  );
  const credit = policy.find(
    (item) => item.file === "apps/web/public/terms/index.html",
  );
  assert.ok(credit);
  assert.deepEqual(await checkOutput(path.dirname(credit.file)), []);
  const directory = await mkdtemp(path.join(root, ".cache-branding-credit-"));
  try {
    await writeFile(path.join(directory, "index.html"), credit.value);
    assert.deepEqual(
      (await checkOutput(path.relative(root, directory))).map(
        (item) => item.term,
      ),
      ["Kaneo"],
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
