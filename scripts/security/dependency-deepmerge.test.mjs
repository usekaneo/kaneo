import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const mobileRequire = createRequire(
  new URL("../../apps/mobile/package.json", import.meta.url),
);
const expoRequire = createRequire(mobileRequire.resolve("expo/package.json"));
const configRequire = createRequire(expoRequire.resolve("@expo/config"));
const merge = configRequire("deepmerge");

test("deepmerge cannot poison a result through null-prototype sources or targets", () => {
  const source = JSON.parse('{"__proto__":{"privileged":true},"name":"safe"}');
  for (const target of [{}, Object.create(null), source]) {
    for (const input of [source, Object.assign(Object.create(null), source)]) {
      const result = merge(target, input);
      assert.equal(Object.getPrototypeOf(result), Object.prototype);
      assert.equal(result.privileged, undefined);
      assert.equal(Object.hasOwn(result, "__proto__"), false);
      assert.equal(result.name, "safe");
    }
  }
  assert.equal({}.privileged, undefined);
});

test("deepmerge protects nested objects, arrays and merge.all without changing ordinary data", () => {
  const unsafe = JSON.parse(
    '{"nested":{"__proto__":{"privileged":true}},"items":[{"__proto__":{"privileged":true}}]}',
  );
  const result = merge.all([
    { nested: { title: "kept" }, items: ["first"] },
    unsafe,
  ]);
  assert.deepEqual(result, { nested: { title: "kept" }, items: ["first", {}] });
  assert.equal(Object.getPrototypeOf(result.nested), Object.prototype);
  assert.equal(Object.getPrototypeOf(result.items[1]), Object.prototype);
  const symbol = Symbol("kept");
  assert.deepEqual(merge({ [symbol]: "value", a: [1] }, { a: [2] }), {
    [symbol]: "value",
    a: [1, 2],
  });
  assert.deepEqual(
    merge({ a: [1] }, { a: [2] }, { arrayMerge: (_a, b) => b }),
    { a: [2] },
  );
});
