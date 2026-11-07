import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const webRequire = createRequire(
  new URL("../../apps/web/package.json", import.meta.url),
);
const routerRequire = createRequire(
  webRequire.resolve("@tanstack/react-router"),
);
const coreRequire = createRequire(
  routerRequire.resolve("@tanstack/router-core"),
);
const seroval = coreRequire("seroval");

test("the router's Seroval rejects array nodes whose elements are an attacker-controlled object", () => {
  const payload = seroval.toJSON(["valid"]);
  // A small finite length proves rejection without running an exhaustion payload.
  payload.t.a = { length: 512 };
  assert.throws(() => seroval.fromJSON(payload), seroval.SerovalError);
});

test("Seroval retains shared references, cycles and application value types", () => {
  const value = {
    when: new Date("2026-11-02T00:00:00Z"),
    map: new Map([["key", 1]]),
    bytes: new Uint8Array([1, 2]),
  };
  value.self = value;
  const copy = seroval.fromJSON(seroval.toJSON(value));
  assert.equal(copy.self, copy);
  assert.equal(copy.when.toISOString(), value.when.toISOString());
  assert.deepEqual(copy.map, value.map);
  assert.deepEqual(copy.bytes, value.bytes);
});

test("Seroval serializes the actual typed-array type instead of an own constructor name", () => {
  const bytes = new Uint8Array([1, 2]);
  Object.defineProperty(bytes, "constructor", {
    value: { name: "KaneoInjectedConstructor" },
  });
  const serialized = seroval.serialize(bytes);
  assert.doesNotMatch(serialized, /KaneoInjectedConstructor/);
  assert.deepEqual(seroval.deserialize(serialized), new Uint8Array([1, 2]));
});

test("Seroval escapes closing script tags in RegExp sources while preserving the expression", () => {
  const value = new RegExp("</script><script>synthetic</script>", "i");
  const serialized = seroval.serialize(value);
  assert.doesNotMatch(serialized, /<\/script/i);
  const copy = seroval.deserialize(serialized);
  assert.equal(copy.source, value.source);
  assert.equal(copy.flags, value.flags);
});
