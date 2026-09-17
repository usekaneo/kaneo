import assert from "node:assert/strict";
import test from "node:test";
import { PNG } from "pngjs";
import { decodeScreenshot } from "../images.mjs";

const valid = PNG.sync.write(new PNG({ width: 1440, height: 1000 }));

test("bounded screenshot decoding preserves normal browser PNGs", () => {
  const image = decodeScreenshot(valid);
  assert.equal(image.width, 1440);
  assert.equal(image.height, 1000);
  assert.equal(image.data.length, 1440 * 1000 * 4);
});

test("duplicate headers, interlacing, trailing data and oversized chunks are rejected before decoding", () => {
  const duplicate = Buffer.concat([valid.subarray(0, 33), valid.subarray(8)]);
  const interlaced = Buffer.from(valid);
  interlaced[28] = 1;
  const oversized = Buffer.from(valid);
  oversized.writeUInt32BE(0xffffffff, 33);
  for (const bytes of [
    duplicate,
    interlaced,
    oversized,
    Buffer.concat([valid, Buffer.from("extra")]),
    valid.subarray(0, -12),
  ])
    assert.throws(() => decodeScreenshot(bytes), /Invalid screenshot/);
});

test("compressed pixels cannot expand beyond the declared screenshot size", () => {
  const bigger = PNG.sync.write(new PNG({ width: 1440, height: 1001 }));
  const bomb = Buffer.concat([valid.subarray(0, 33), bigger.subarray(33)]);
  assert.throws(() => decodeScreenshot(bomb), /Invalid screenshot/);
});

test("focused previews accept bounded dimensions while full captures keep their exact size", () => {
  const preview = PNG.sync.write(new PNG({ width: 784, height: 298 }));
  assert.throws(() => decodeScreenshot(preview), /Invalid screenshot/);
  assert.equal(decodeScreenshot(preview, { preview: true }).height, 298);
  for (const [width, height] of [
    [319, 200],
    [640, 159],
    [1441, 200],
    [640, 1001],
  ])
    assert.throws(
      () =>
        decodeScreenshot(PNG.sync.write(new PNG({ width, height })), {
          preview: true,
        }),
      /Invalid screenshot/,
    );
});
