import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { dirname } from "node:path";
import test from "node:test";
const mobileRequire = createRequire(
  new URL("../../apps/mobile/package.json", import.meta.url),
);
const expoRequire = createRequire(mobileRequire.resolve("expo/package.json"));
const cliRequire = createRequire(expoRequire.resolve("@expo/cli/package.json"));
const dir = dirname(cliRequire.resolve("zod/package.json"));
assert.equal(
  cliRequire("zod/package.json").version,
  "3.25.76",
  "Update this backport test when Expo changes its Zod dependency",
);
// GHSA-mrhx-c7xc-m3w5; upstream v4 fix: colinhacks/zod#6652, v3 tracking: #6653.
const require = createRequire(import.meta.url);
for (const entry of ["index", "v3/index", "v4/index", "v4-mini/index"]) {
  for (const format of ["js", "cjs"]) {
    const z =
      format === "js"
        ? await import(pathToFileURL(`${dir}/${entry}.js`))
        : require(`${dir}/${entry}.cjs`);
    const v3 = entry === "index" || entry === "v3/index";
    const label = `${entry}.${format}`;
    const refined = (fn) =>
      v3 ? z.string().refine(fn) : z.string().check(z.refine(fn));
    const array = (el, bound, exact = false) =>
      v3
        ? exact
          ? z.array(el).length(bound, "cap")
          : z.array(el).max(bound, "cap")
        : z
            .array(el)
            .check(
              exact
                ? z.length(bound, { error: "cap" })
                : z.maxLength(bound, { error: "cap" }),
            );
    const set = (el) =>
      v3
        ? z.set(el).size(2, "cap")
        : z.set(el).check(z.size(2, { error: "cap" }));
    const parse = (schema, value, async = false) =>
      v3
        ? async
          ? schema.safeParseAsync(value)
          : schema.safeParse(value)
        : async
          ? z.safeParseAsync(schema, value)
          : z.safeParse(schema, value);
    test(`${label}: bounded array/set reject before elements or outer refinements, sync and async`, async () => {
      let elements = 0,
        outer = 0;
      const element = refined(() => {
        elements++;
        return true;
      });
      const cases = [
        [array(element, 2), ["a", "b", "c"]],
        [array(element, 2, true), ["a", "b", "c"]],
        [set(element), new Set(["a", "b", "c"])],
        [array(z.string(), 2), Array(10000).fill(0)],
      ];
      for (let [schema, value] of cases) {
        schema = v3
          ? schema.refine(() => {
              outer++;
              return true;
            })
          : schema.check(
              z.refine(() => {
                outer++;
                return true;
              }),
            );
        for (const async of [false, true]) {
          const result = await parse(schema, value, async);
          assert.equal(result.success, false);
          assert.equal(result.error.issues.length, 1);
          assert.equal(result.error.issues[0].code, "too_big");
          assert.equal(result.error.issues[0].message, "cap");
          assert.deepEqual(result.error.issues[0].path, []);
        }
      }
      assert.equal(elements, 0);
      assert.equal(outer, 0);
      assert.deepEqual((await parse(array(element, 2), ["a", "b"])).data, [
        "a",
        "b",
      ]);
      assert.equal(elements, 2);
    });
    test(`${label}: nested paths, invalid types, undersize and unbounded aggregation remain`, () => {
      const result = parse(z.object({ items: array(z.string(), 1) }), {
        items: ["a", "b"],
      });
      assert.deepEqual(result.error.issues[0].path, ["items"]);
      assert.equal(
        parse(array(z.string(), 1), new Set(["a", "b"])).error.issues[0].code,
        "invalid_type",
      );
      const exact = parse(array(z.string(), 2, true), [1]);
      assert.deepEqual(exact.error.issues.map((i) => i.code).sort(), [
        "invalid_type",
        "too_small",
      ]);
      const unbounded = parse(z.array(z.string()), Array(5).fill(0));
      assert.equal(unbounded.error.issues.length, 5);
      const union = z.union([array(z.string(), 1), z.array(z.string())]);
      assert.deepEqual(parse(union, ["a", "b"]).data, ["a", "b"]);
    });
    if (v3) {
      test(`${label}: v3 transforms, preprocess, error maps, and set/map APIs remain`, async () => {
        const schema = z.preprocess(
          (v) => v.slice(0, 2),
          z.array(z.string().transform((v) => v.toUpperCase())).max(2),
        );
        assert.deepEqual(schema.parse(["a", "b", "c"]), ["A", "B"]);
        assert.deepEqual(await schema.parseAsync(["a", "b", "c"]), ["A", "B"]);
        assert.deepEqual(
          z.map(z.string(), z.number()).parse(new Map([["a", 1]])),
          new Map([["a", 1]]),
        );
        const limited = z.array(z.string()).max(1);
        const failure = limited.safeParse(["a", "b"], {
          errorMap: (issue, ctx) => ({
            message: issue.code === "too_big" ? "mapped cap" : ctx.defaultError,
          }),
        });
        assert.equal(failure.error.issues[0].message, "mapped cap");
        assert.equal(failure.error.issues[0].maximum, 1);
        assert.equal(failure.error.issues[0].inclusive, true);
        assert.equal(failure.error.issues[0].exact, false);
      });
    } else {
      test(`${label}: embedded v4 maps and rewriting checks respect bounds/order`, async () => {
        let calls = 0;
        const element = refined(() => {
          calls++;
          return true;
        });
        const schema = z.map(element, element).check(z.maxSize(1));
        for (const async of [false, true]) {
          const result = await parse(
            schema,
            new Map([
              ["a", "b"],
              ["c", "d"],
            ]),
            async,
          );
          assert.deepEqual(
            result.error.issues.map((i) => i.code),
            ["too_big"],
          );
        }
        assert.equal(calls, 0);
        const shrinking = z.array(z.number()).check(
          z.overwrite((v) => v.slice(0, 2)),
          z.maxLength(2),
        );
        assert.deepEqual(parse(shrinking, [1, 2, 3]).data, [1, 2]);
        const conditional = z
          .array(z.string())
          .check(z.maxLength(1, { when: () => false }));
        assert.deepEqual(parse(conditional, ["a", "b"]).data, ["a", "b"]);
      });
    }
  }
}
