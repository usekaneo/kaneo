import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import db from "../../apps/api/src/database";
import * as schema from "../../apps/api/src/database/schema";
import { createApp } from "../../apps/api/src/index";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import { createWorkspaceMember } from "./helpers/fixtures";
import { addWorkspaceMember } from "./helpers/project-access/add-workspace-member";

type User = Parameters<typeof mockAuthenticatedSession>[0];
type Option = {
  key: string;
  label: string;
  position: number;
  contactCount: number;
};

async function call(user: User, method: string, path: string, body?: unknown) {
  mockAuthenticatedSession(user);
  const { app } = createApp();
  const response = await app.request(`/api${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return {
    status: response.status,
    body: await response.json().catch(() => null),
  };
}

const labels = (options: Option[]) => options.map((option) => option.label);

async function setup() {
  const { user: owner, workspace } = await createWorkspaceMember({
    role: "owner",
  });
  const base = `/contact/workspace/${workspace.id}`;
  return { owner, workspace, base, options: `${base}/options` };
}

beforeEach(resetTestDatabase);

describe("contact options: defaults", () => {
  it("seeds the defaults on first read with keys that match stored values", async () => {
    const { owner, options } = await setup();
    const response = await call(owner, "GET", options);

    expect(response.status).toBe(200);
    expect(response.body.types.map((o: Option) => o.key)).toEqual([
      "retailer",
      "distributor",
      "end-user",
      "partner",
      "other",
    ]);
    expect(labels(response.body.types)).toEqual([
      "Retailer",
      "Distributor",
      "End user",
      "Partner",
      "Other",
    ]);
    expect(response.body.regions.map((o: Option) => o.key)).toEqual([
      "male",
      "hulhumale",
      "north-atolls",
      "central-atolls",
      "south-atolls",
      "other",
    ]);
    expect(labels(response.body.regions)[0]).toBe("Malé");
    expect(response.body.regions.map((o: Option) => o.position)).toEqual([
      0, 1, 2, 3, 4, 5,
    ]);
  });

  it("is idempotent, including two concurrent first reads", async () => {
    const { owner, workspace, options } = await setup();
    const [a, b] = await Promise.all([
      call(owner, "GET", options),
      call(owner, "GET", options),
    ]);
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    await call(owner, "GET", options);

    const rows = await db
      .select()
      .from(schema.contactOptionTable)
      .where(eq(schema.contactOptionTable.workspaceId, workspace.id));
    expect(rows).toHaveLength(11);
  });

  it("keeps existing contacts valid and labelled without anyone opening the settings first", async () => {
    const { owner, workspace, base } = await setup();
    await db.insert(schema.contactTable).values({
      workspaceId: workspace.id,
      name: "Old Ali",
      type: "retailer",
      region: "male",
    });

    const list = await call(owner, "GET", base);
    expect(list.body[0]).toMatchObject({
      type: "retailer",
      typeLabel: "Retailer",
      region: "male",
      regionLabel: "Malé",
    });
    const counts = await call(owner, "GET", `${base}/options`);
    expect(
      counts.body.types.find((o: Option) => o.key === "retailer").contactCount,
    ).toBe(1);
    expect(
      counts.body.regions.find((o: Option) => o.key === "male").contactCount,
    ).toBe(1);
    expect(
      counts.body.types.find((o: Option) => o.key === "partner").contactCount,
    ).toBe(0);
  });
});

describe("contact options: managing", () => {
  it("renames without unlinking contacts and rejects duplicates", async () => {
    const { owner, base, options } = await setup();
    const contact = await call(owner, "POST", base, {
      name: "Ali",
      type: "retailer",
    });

    const renamed = await call(owner, "PATCH", `${options}/type/retailer`, {
      label: "  Shop   owner ",
    });
    expect(renamed.status).toBe(200);
    expect(renamed.body).toMatchObject({
      key: "retailer",
      label: "Shop owner",
      contactCount: 1,
    });
    const list = await call(owner, "GET", base);
    expect(list.body[0]).toMatchObject({
      id: contact.body.id,
      type: "retailer",
      typeLabel: "Shop owner",
    });

    const clash = await call(owner, "PATCH", `${options}/type/retailer`, {
      label: "PARTNER",
    });
    expect(clash.status).toBe(409);
    // Changing only the case of its own label is fine, and renaming back works.
    expect(
      (
        await call(owner, "PATCH", `${options}/type/retailer`, {
          label: "SHOP owner",
        })
      ).status,
    ).toBe(200);
    const back = await call(owner, "PATCH", `${options}/type/retailer`, {
      label: "Retailer",
    });
    expect(back.body.label).toBe("Retailer");
    expect(
      (await call(owner, "PATCH", `${options}/type/missing`, { label: "X" }))
        .status,
    ).toBe(404);
    expect(
      (await call(owner, "PATCH", `${options}/type/retailer`, { label: "  " }))
        .status,
    ).toBe(400);
  });

  it("adds one or many names, drops blanks, dedupes, and skips existing ones", async () => {
    const { owner, options } = await setup();
    const one = await call(owner, "POST", options, {
      kind: "region",
      label: " Maafushi ",
    });
    expect(one.status).toBe(201);
    expect(one.body.created).toHaveLength(1);
    expect(one.body.created[0]).toMatchObject({
      label: "Maafushi",
      position: 6,
      contactCount: 0,
    });
    expect(one.body.created[0].key).not.toBe("maafushi-key");

    const bulk = await call(owner, "POST", options, {
      kind: "region",
      labels: [
        "Thulusdhoo",
        "",
        "  ",
        "thulusdhoo",
        "MAAFUSHI",
        "malé",
        "Guraidhoo",
      ],
    });
    expect(bulk.status).toBe(201);
    expect(labels(bulk.body.created)).toEqual(["Thulusdhoo", "Guraidhoo"]);
    expect(bulk.body.skipped.sort()).toEqual([
      "MAAFUSHI",
      "malé",
      "thulusdhoo",
    ]);

    const listed = await call(owner, "GET", options);
    expect(labels(listed.body.regions).slice(6)).toEqual([
      "Maafushi",
      "Thulusdhoo",
      "Guraidhoo",
    ]);
    // Types are a separate list.
    expect(listed.body.types).toHaveLength(5);

    expect(
      (await call(owner, "POST", options, { kind: "region" })).status,
    ).toBe(400);
    expect(
      (await call(owner, "POST", options, { kind: "nope", label: "x" })).status,
    ).toBe(400);
  });

  it("caps a request at 500 names and a list at 2000 options", async () => {
    const { owner, workspace, options } = await setup();
    const names = (from: number, count: number) =>
      Array.from({ length: count }, (_, i) => `Island ${from + i}`);

    expect(
      (
        await call(owner, "POST", options, {
          kind: "region",
          labels: names(0, 501),
        })
      ).status,
    ).toBe(400);
    const ok = await call(owner, "POST", options, {
      kind: "region",
      labels: names(0, 500),
    });
    expect(ok.status).toBe(201);
    expect(ok.body.created).toHaveLength(500);

    for (const from of [500, 1000, 1500]) {
      await call(owner, "POST", options, {
        kind: "region",
        labels: names(from, from === 1500 ? 494 : 500),
      });
    }
    // 6 defaults + 1994 = 2000: full.
    const full = await db.$count(
      schema.contactOptionTable,
      and(
        eq(schema.contactOptionTable.workspaceId, workspace.id),
        eq(schema.contactOptionTable.kind, "region"),
      ),
    );
    expect(full).toBe(2000);
    const over = await call(owner, "POST", options, {
      kind: "region",
      label: "One too many",
    });
    expect(over.status).toBe(400);
    // Repeats of existing names still just skip.
    const repeat = await call(owner, "POST", options, {
      kind: "region",
      label: "island 3",
    });
    expect(repeat.status).toBe(201);
    expect(repeat.body.skipped).toEqual(["island 3"]);
  }, 120_000);

  it("reorders, keeps unlisted options after the listed ones, and rejects bad keys", async () => {
    const { owner, options } = await setup();
    const reordered = await call(owner, "PUT", `${options}/type/order`, {
      keys: ["other", "partner"],
    });
    expect(reordered.status).toBe(200);
    expect(reordered.body.types.map((o: Option) => o.key)).toEqual([
      "other",
      "partner",
      "retailer",
      "distributor",
      "end-user",
    ]);
    expect(reordered.body.types.map((o: Option) => o.position)).toEqual([
      0, 1, 2, 3, 4,
    ]);
    expect(
      (await call(owner, "GET", options)).body.types.map(
        (o: Option) => o.key,
      )[0],
    ).toBe("other");

    for (const keys of [["partner", "partner"], ["nope"]]) {
      expect(
        (await call(owner, "PUT", `${options}/type/order`, { keys })).status,
      ).toBe(400);
    }
    // A region key does not work in the type list.
    expect(
      (await call(owner, "PUT", `${options}/type/order`, { keys: ["male"] }))
        .status,
    ).toBe(400);
  });

  it("deletes an option, clears it from contacts, and reports how many", async () => {
    const { owner, base, options } = await setup();
    const a = await call(owner, "POST", base, {
      name: "A",
      region: "male",
      type: "partner",
    });
    await call(owner, "POST", base, { name: "B", region: "male" });
    await call(owner, "POST", base, { name: "C", region: "hulhumale" });

    const removed = await call(owner, "DELETE", `${options}/region/male`);
    expect(removed.status).toBe(200);
    expect(removed.body).toEqual({ key: "male", affectedContacts: 2 });

    const list = await call(owner, "GET", base);
    const byName = Object.fromEntries(
      list.body.map((c: { name: string }) => [c.name, c]),
    );
    expect(byName.A).toMatchObject({
      region: null,
      regionLabel: null,
      type: "partner",
    });
    expect(byName.C.region).toBe("hulhumale");
    expect((await call(owner, "DELETE", `${options}/region/male`)).status).toBe(
      404,
    );

    // Re-adding the name makes a new option; the old contacts stay not set.
    const readded = await call(owner, "POST", options, {
      kind: "region",
      label: "Malé",
    });
    expect(labels(readded.body.created)).toEqual(["Malé"]);
    const again = await call(owner, "GET", `${base}/${a.body.id}/timeline`);
    expect(again.status).toBe(200);
    // Deleting an option does not bring back defaults.
    const regions = (await call(owner, "GET", options)).body.regions;
    expect(regions.some((o: Option) => o.key === "male")).toBe(false);
  });

  it("refuses to delete the last option of a list", async () => {
    const { owner, options } = await setup();
    for (const key of ["retailer", "distributor", "end-user", "partner"]) {
      expect(
        (await call(owner, "DELETE", `${options}/type/${key}`)).status,
      ).toBe(200);
    }
    const last = await call(owner, "DELETE", `${options}/type/other`);
    expect(last.status).toBe(400);
    const types = (await call(owner, "GET", options)).body.types;
    expect(labels(types)).toEqual(["Other"]);
  });

  it("serialises concurrent deletes so a list never empties", async () => {
    const { owner, options } = await setup();
    for (const key of ["retailer", "distributor", "end-user"]) {
      await call(owner, "DELETE", `${options}/type/${key}`);
    }
    const results = await Promise.all([
      call(owner, "DELETE", `${options}/type/partner`),
      call(owner, "DELETE", `${options}/type/other`),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 400]);
    expect((await call(owner, "GET", options)).body.types).toHaveLength(1);
  });
});

describe("contact options: using them on contacts", () => {
  it("accepts a key or a label in any case and stores the key", async () => {
    const { owner, base } = await setup();
    const byLabel = await call(owner, "POST", base, {
      name: "A",
      type: "retailer",
      region: "  hulhumalé ",
    });
    expect(byLabel.status).toBe(201);
    expect(byLabel.body).toMatchObject({
      type: "retailer",
      typeLabel: "Retailer",
      region: "hulhumale",
      regionLabel: "Hulhumalé",
    });
    const byKey = await call(owner, "PATCH", `${base}/${byLabel.body.id}`, {
      type: "End USER",
      region: "north-atolls",
    });
    expect(byKey.body).toMatchObject({
      type: "end-user",
      typeLabel: "End user",
      region: "north-atolls",
    });
  });

  it("stores null when nothing is given and lets null clear a value", async () => {
    const { owner, base } = await setup();
    const none = await call(owner, "POST", base, { name: "No type" });
    expect(none.body).toMatchObject({
      type: null,
      typeLabel: null,
      region: null,
      regionLabel: null,
    });
    const set = await call(owner, "PATCH", `${base}/${none.body.id}`, {
      type: "partner",
    });
    expect(set.body.type).toBe("partner");
    const kept = await call(owner, "PATCH", `${base}/${none.body.id}`, {
      name: "Renamed",
    });
    expect(kept.body.type).toBe("partner");
    const cleared = await call(owner, "PATCH", `${base}/${none.body.id}`, {
      type: null,
    });
    expect(cleared.body).toMatchObject({ type: null, typeLabel: null });
  });

  it("rejects unknown values with the valid choices, on write and on filter", async () => {
    const { owner, base } = await setup();
    const bad = await call(owner, "POST", base, {
      name: "X",
      type: "wholesaler",
    });
    expect(bad.status).toBe(400);
    expect(JSON.stringify(bad.body)).toContain("Retailer");
    expect(JSON.stringify(bad.body)).toContain("Distributor");
    const badRegion = await call(owner, "POST", base, {
      name: "X",
      region: "Mars",
    });
    expect(badRegion.status).toBe(400);
    expect(JSON.stringify(badRegion.body)).toContain("Malé");
    const contact = await call(owner, "POST", base, { name: "Y" });
    expect(
      (
        await call(owner, "PATCH", `${base}/${contact.body.id}`, {
          region: "nowhere",
        })
      ).status,
    ).toBe(400);
    expect((await call(owner, "GET", `${base}?type=wholesaler`)).status).toBe(
      400,
    );
    expect(await db.$count(schema.contactTable)).toBe(1);
  });

  it("filters by key or label and follows renames", async () => {
    const { owner, base, options } = await setup();
    await call(owner, "POST", base, { name: "A", region: "male" });
    await call(owner, "POST", base, { name: "B", region: "hulhumale" });
    await call(owner, "POST", base, { name: "C" });

    const byKey = await call(owner, "GET", `${base}?region=male`);
    expect(byKey.body.map((c: { name: string }) => c.name)).toEqual(["A"]);
    const byLabel = await call(owner, "GET", `${base}?region=Hulhumal%C3%A9`);
    expect(byLabel.body.map((c: { name: string }) => c.name)).toEqual(["B"]);

    await call(owner, "PATCH", `${options}/region/male`, { label: "Capital" });
    const renamed = await call(owner, "GET", `${base}?region=capital`);
    expect(renamed.body.map((c: { name: string }) => c.name)).toEqual(["A"]);
    expect(renamed.body[0].regionLabel).toBe("Capital");
    // The old label no longer resolves.
    expect((await call(owner, "GET", `${base}?region=Malé`)).status).toBe(400);
  });
});

describe("contact options: permissions and isolation", () => {
  it("lets members and viewers read but only owners and admins write", async () => {
    const { owner, workspace, options } = await setup();
    const admin = await addWorkspaceMember(workspace.id, "admin");
    const member = await addWorkspaceMember(workspace.id, "member");
    const viewer = await addWorkspaceMember(workspace.id, "viewer");

    for (const user of [owner, admin, member, viewer]) {
      expect((await call(user, "GET", options)).status).toBe(200);
    }
    for (const user of [member, viewer]) {
      expect(
        (await call(user, "POST", options, { kind: "type", label: "VIP" }))
          .status,
      ).toBe(403);
      expect(
        (await call(user, "PATCH", `${options}/type/other`, { label: "x" }))
          .status,
      ).toBe(403);
      expect(
        (await call(user, "PUT", `${options}/type/order`, { keys: ["other"] }))
          .status,
      ).toBe(403);
      expect((await call(user, "DELETE", `${options}/type/other`)).status).toBe(
        403,
      );
    }
    expect(
      (await call(admin, "POST", options, { kind: "type", label: "VIP" }))
        .status,
    ).toBe(201);
    expect((await call(owner, "DELETE", `${options}/type/other`)).status).toBe(
      200,
    );
    // Members can still use the options when editing contacts.
    expect(
      (
        await call(member, "POST", `/contact/workspace/${workspace.id}`, {
          name: "By member",
          type: "VIP",
        })
      ).status,
    ).toBe(201);
  });

  it("keeps each workspace's options private", async () => {
    const a = await setup();
    const b = await setup();
    await call(b.owner, "POST", b.options, {
      kind: "type",
      label: "Secret tier",
    });
    const bTypes = (await call(b.owner, "GET", b.options)).body.types;
    const secret = bTypes.find((o: Option) => o.label === "Secret tier");

    expect(
      JSON.stringify((await call(a.owner, "GET", a.options)).body),
    ).not.toContain("Secret tier");
    expect([403, 404]).toContain(
      (await call(a.owner, "GET", b.options)).status,
    );
    expect([403, 404]).toContain(
      (await call(a.owner, "POST", b.options, { kind: "type", label: "Mine" }))
        .status,
    );
    // A's owner cannot rename or delete B's option through A's workspace.
    expect(
      (
        await call(a.owner, "PATCH", `${a.options}/type/${secret.key}`, {
          label: "x",
        })
      ).status,
    ).toBe(404);
    expect(
      (await call(a.owner, "DELETE", `${a.options}/type/${secret.key}`)).status,
    ).toBe(404);
    // B's key and label are not valid for A's contacts.
    for (const type of [secret.key, "Secret tier"]) {
      expect(
        (await call(a.owner, "POST", a.base, { name: "X", type })).status,
      ).toBe(400);
    }
    // Deleting in A leaves B's contacts alone.
    await call(b.owner, "POST", b.base, { name: "B contact", type: "partner" });
    await call(a.owner, "DELETE", `${a.options}/type/partner`);
    expect((await call(b.owner, "GET", b.base)).body[0].type).toBe("partner");
  });
});
