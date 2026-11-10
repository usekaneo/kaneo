import assert from "node:assert/strict";
import {
  mkdtemp,
  readFile,
  rm,
  writeFile,
  symlink,
  mkdir,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { PNG } from "pngjs";
import path from "node:path";
import test from "node:test";
import { brand, brandAssetUrl } from "../../branding/index.cjs";
import { root, digest } from "./assets.mjs";
import { checkAssets, checkOutput } from "./check.mjs";
import { prepareWebPublic } from "./prepare-web-public.mjs";
import { brandHtml } from "./html.mjs";
import { prepareDocs } from "./prepare.mjs";
import { assertApprovedMaster } from "./approved-master.mjs";
import { assertAndroidSafeArea } from "./native-safe-area.mjs";

const directory = path.join(root, "branding/assets/quills/public");

test("exports require the exact user-approved master, even for another valid 3:1 PNG", async () => {
  const bytes = await readFile(
    path.join(root, "branding/assets/quills-logo-v1.png"),
  );
  assert.doesNotThrow(() => assertApprovedMaster(bytes));
  const image = PNG.sync.read(bytes);
  image.data[3] = 255 - image.data[3];
  assert.throws(
    () => assertApprovedMaster(PNG.sync.write(image)),
    /user-approved artwork/,
  );
});

test("both Android layers keep every visible pixel in the guaranteed safe circle", async () => {
  for (const name of ["android-icon-foreground", "android-icon-monochrome"]) {
    const bytes = await readFile(path.join(directory, `native/${name}.png`));
    assert.doesNotThrow(() => assertAndroidSafeArea(bytes));
    const image = PNG.sync.read(bytes);
    image.data[3] = 255;
    assert.throws(
      () => assertAndroidSafeArea(PNG.sync.write(image)),
      /safe circle/,
    );
  }
});

test("public and docs preparation reject symlink ancestors without touching external files", async () => {
  const cache = await mkdtemp(path.join(root, ".cache/quills-path-test-"));
  const outside = await mkdtemp(path.join(tmpdir(), "quills-path-test-"));
  try {
    const target = path.join(outside, "target");
    await mkdir(target);
    await writeFile(path.join(target, "sentinel.txt"), "keep");
    await symlink(outside, path.join(cache, "link"), "dir");
    await symlink(target, path.join(cache, "direct"), "dir");
    for (const prepare of [prepareWebPublic, prepareDocs]) {
      await assert.rejects(
        prepare(path.join(cache, "link/target")),
        /Symbolic link/,
      );
      await assert.rejects(
        prepare(path.join(cache, "direct")),
        /Symbolic link/,
      );
      assert.equal(
        await readFile(path.join(target, "sentinel.txt"), "utf8"),
        "keep",
      );
    }
  } finally {
    await rm(cache, { recursive: true, force: true });
    await rm(outside, { recursive: true, force: true });
  }
});

test("colorways share vector geometry and favicons follow the browser theme", async () => {
  const dark = await readFile(path.join(directory, "logo-dark.svg"), "utf8");
  const light = await readFile(path.join(directory, "logo-light.svg"), "utf8");
  assert.deepEqual(
    [...dark.matchAll(/<path[^>]*>/g)].map((item) => item[0]),
    [...light.matchAll(/<path[^>]*>/g)].map((item) => item[0]),
  );
  assert.match(dark, /<path /);
  assert.match(dark, /color:#171717/);
  assert.match(light, /color:#f5f5f5/);
  assert.doesNotMatch(dark + light, /<image|<text|data:image|font-family/);
  assert.match(
    await readFile(path.join(directory, "favicon.svg"), "utf8"),
    /prefers-color-scheme:dark/,
  );
  assert.equal(
    [
      ...(
        await readFile(path.join(directory, "mark-dark.svg"), "utf8")
      ).matchAll(/<path /g),
    ].length,
    1,
    "the isolated mark must not include a slice of the wordmark",
  );
});

test("PNG and ICO exports have the advertised dimensions and RGBA encoding", async () => {
  const sizes = {
    "apple-touch-icon.png": 180,
    "web-app-manifest-192x192.png": 192,
    "web-app-manifest-512x512.png": 512,
    "icon-1024.png": 1024,
    "email/mark.png": 256,
    "native/android-icon-foreground.png": 1024,
    "native/notification-icon.png": 96,
  };
  for (const size of [16, 32, 48, 96, 256])
    sizes[`favicon-${size}x${size}.png`] = size;
  for (const [name, size] of Object.entries(sizes)) {
    const png = await readFile(path.join(directory, name));
    assert.equal(png.subarray(1, 4).toString(), "PNG", name);
    assert.equal(png.readUInt32BE(16), size, name);
    assert.equal(png.readUInt32BE(20), size, name);
    assert.equal(png[25], 6, `${name}: RGBA`);
  }
  const social = await readFile(path.join(directory, "readme.png"));
  assert.deepEqual(
    [social.readUInt32BE(16), social.readUInt32BE(20)],
    [1200, 630],
  );
  const ico = await readFile(path.join(directory, "favicon.ico"));
  assert.equal(ico.readUInt16LE(2), 1);
  assert.equal(ico.readUInt16LE(4), 6);
  assert.deepEqual(
    Array.from({ length: 6 }, (_, i) => ico[6 + i * 16] || 256),
    [256, 128, 64, 48, 32, 16],
  );
});

test("generated assets pass output validation and cover native branding", async () => {
  assert.deepEqual(await checkOutput(path.relative(root, directory)), []);
  assert.deepEqual(await checkAssets(["apps/mobile/assets"]), []);
  for (const asset of brand.assets.filter((item) =>
    item.source.startsWith("assets/quills/"),
  ))
    assert.equal(
      digest(await readFile(path.join(root, "branding", asset.source))),
      asset.sha256,
      asset.target,
    );
});

test("public overlay serves artwork, versions manifest icons and removes stale files", async () => {
  const output = await mkdtemp(path.join(root, ".cache/quills-public-test-"));
  try {
    await writeFile(path.join(output, "stale.txt"), "old");
    await prepareWebPublic(output);
    await assert.rejects(readFile(path.join(output, "stale.txt")), {
      code: "ENOENT",
    });
    assert.deepEqual(
      await readFile(path.join(output, "logo-dark.svg")),
      await readFile(path.join(directory, "logo-dark.svg")),
    );
    const manifest = JSON.parse(
      await readFile(path.join(output, "site.webmanifest"), "utf8"),
    );
    assert.equal(manifest.name, brand.name);
    for (const icon of manifest.icons)
      assert.equal(
        icon.src,
        brandAssetUrl(
          `apps/web/public/${path.basename(icon.src.split("?")[0])}`,
        ),
      );
    const html = brandHtml(
      '<meta property="og:image" content="https://assets.kaneo.app/readme.png">',
    );
    assert.ok(
      html.includes(
        new URL(brandAssetUrl("apps/web/public/readme.png"), brand.publicUrl)
          .href,
      ),
    );
  } finally {
    await rm(output, { recursive: true, force: true });
  }
});

test("a changed approved asset prevents preparing the public overlay", async () => {
  const output = await mkdtemp(path.join(root, ".cache/quills-public-test-"));
  const asset = brand.assets.find(
    (item) => item.target === "apps/web/public/logo-dark.svg",
  );
  const hash = asset.sha256;
  try {
    asset.sha256 = "changed";
    await assert.rejects(
      prepareWebPublic(output),
      /Unapproved or changed replacement/,
    );
  } finally {
    asset.sha256 = hash;
    await rm(output, { recursive: true, force: true });
  }
});
