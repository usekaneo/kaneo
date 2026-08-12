import { createId } from "@paralleldrive/cuid2";
import { desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import * as v from "valibot";
import db, { schema } from "../database";

function addMonths(date: Date, months: number) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

const license = new Hono()
  .get(
    "/status",
    describeRoute({
      operationId: "getLicenseStatus",
      tags: ["License"],
      description: "Get active license on this instance",
      security: [],
      responses: {
        200: {
          description: "License status",
          content: { "application/json": { schema: resolver(v.any()) } },
        },
      },
    }),
    async (c) => {
      const [row] = await db
        .select()
        .from(schema.instanceLicenseTable)
        .orderBy(desc(schema.instanceLicenseTable.activatedAt))
        .limit(1);

      if (!row) {
        return c.json({ active: false, sku: null, expiresAt: null });
      }

      const expired =
        row.expiresAt !== null && row.expiresAt.getTime() < Date.now();

      return c.json({
        active: row.status === "active" && !expired,
        sku: row.sku,
        keyMasked: `${row.key.slice(0, 4)}…${row.key.slice(-4)}`,
        expiresAt: row.expiresAt,
        activatedAt: row.activatedAt,
      });
    },
  )
  .post(
    "/activate",
    describeRoute({
      operationId: "activateLicense",
      tags: ["License"],
      description: "Activate a Local license key on this instance",
      responses: {
        200: {
          description: "Activated",
          content: { "application/json": { schema: resolver(v.any()) } },
        },
      },
    }),
    validator(
      "json",
      v.object({
        key: v.pipe(v.string(), v.minLength(8)),
        customerEmail: v.optional(v.pipe(v.string(), v.email())),
      }),
    ),
    async (c) => {
      const { key, customerEmail } = c.req.valid("json");
      const normalized = key.trim().toUpperCase();

      const [catalog] = await db
        .select()
        .from(schema.licenseKeyTable)
        .where(eq(schema.licenseKeyTable.key, normalized))
        .limit(1);

      // Allow offline-style activation with ET-LOCAL-* keys even if not pre-seeded
      const sku =
        catalog?.sku ??
        (normalized.startsWith("ET-LOCAL")
          ? "local"
          : normalized.startsWith("ET-CLOUD")
            ? "cloud_monthly"
            : null);

      if (!sku) {
        return c.json({ error: "Invalid license key" }, 400);
      }

      if (catalog && catalog.status === "revoked") {
        return c.json({ error: "License revoked" }, 400);
      }

      const now = new Date();
      const expiresAt =
        sku === "local"
          ? addMonths(now, 12)
          : sku === "cloud_yearly"
            ? addMonths(now, 12)
            : addMonths(now, 1);

      if (catalog) {
        await db
          .update(schema.licenseKeyTable)
          .set({
            status: "active",
            activatedAt: now,
            expiresAt,
            customerEmail: customerEmail ?? catalog.customerEmail,
          })
          .where(eq(schema.licenseKeyTable.id, catalog.id));
      } else {
        await db.insert(schema.licenseKeyTable).values({
          key: normalized,
          sku,
          status: "active",
          customerEmail: customerEmail ?? null,
          activatedAt: now,
          expiresAt,
        });
      }

      const [licenseRow] = await db
        .select()
        .from(schema.licenseKeyTable)
        .where(eq(schema.licenseKeyTable.key, normalized))
        .limit(1);

      await db.delete(schema.instanceLicenseTable);

      await db.insert(schema.instanceLicenseTable).values({
        licenseKeyId: licenseRow?.id,
        key: normalized,
        sku,
        status: "active",
        activatedAt: now,
        expiresAt,
      });

      return c.json({
        active: true,
        sku,
        expiresAt,
        message: "License activated",
      });
    },
  )
  .post(
    "/generate",
    describeRoute({
      operationId: "generateLicenseKeys",
      tags: ["License"],
      description:
        "Admin helper to generate marketplace license keys (requires auth)",
      responses: {
        200: {
          description: "Generated keys",
          content: { "application/json": { schema: resolver(v.any()) } },
        },
      },
    }),
    validator(
      "json",
      v.object({
        sku: v.picklist(["local", "cloud_monthly", "cloud_yearly", "support"]),
        count: v.optional(v.pipe(v.number(), v.minValue(1), v.maxValue(100))),
      }),
    ),
    async (c) => {
      const { sku, count = 1 } = c.req.valid("json");
      const prefix =
        sku === "local"
          ? "ET-LOCAL"
          : sku === "cloud_yearly"
            ? "ET-CLOUD-Y"
            : sku === "support"
              ? "ET-SUP"
              : "ET-CLOUD-M";

      const keys: string[] = [];
      for (let i = 0; i < count; i++) {
        const key = `${prefix}-${createId().slice(0, 12).toUpperCase()}`;
        await db.insert(schema.licenseKeyTable).values({
          key,
          sku,
          status: "unused",
        });
        keys.push(key);
      }

      return c.json({ sku, keys });
    },
  );

export default license;
