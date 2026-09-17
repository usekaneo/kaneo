import assert from "node:assert/strict";
import test from "node:test";
import { frameBounds } from "../framing.mjs";

const viewport = { width: 1440, height: 1000 };
test("component framing includes a portalled menu and keeps readable surrounding context", () => {
  const clip = frameBounds(
    [
      { x: 300, y: 260, width: 736, height: 134 },
      { x: 320, y: 380, width: 350, height: 130 },
    ],
    viewport,
  );
  assert.deepEqual(clip, { x: 276, y: 236, width: 784, height: 298 });
});
test("framing remains inside the viewport at every edge", () => {
  for (const box of [
    { x: 0, y: 0, width: 40, height: 20 },
    { x: 1390, y: 970, width: 50, height: 30 },
  ]) {
    const clip = frameBounds([box], viewport);
    assert.ok(clip.x >= 0 && clip.y >= 0);
    assert.ok(clip.x + clip.width <= viewport.width);
    assert.ok(clip.y + clip.height <= viewport.height);
    assert.ok(clip.x <= box.x && clip.x + clip.width >= box.x + box.width);
    assert.ok(clip.y <= box.y && clip.y + clip.height >= box.y + box.height);
  }
});
test("missing, invalid, and clipped controls cannot become a successful preview", () => {
  for (const boxes of [
    [],
    [null],
    [{ x: Number.NaN, y: 1, width: 50, height: 20 }],
    [{ x: 100, y: 990, width: 50, height: 100 }],
  ])
    assert.throws(() => frameBounds(boxes, viewport));
});
