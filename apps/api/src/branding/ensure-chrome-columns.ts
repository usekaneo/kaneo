import { sql } from "drizzle-orm";
import db from "../database";

const ALTERS = [
  "ALTER TABLE instance_branding ADD COLUMN IF NOT EXISTS background_color text DEFAULT '#0C0C0C'",
  "ALTER TABLE instance_branding ADD COLUMN IF NOT EXISTS foreground_color text DEFAULT '#F5F5F5'",
  "ALTER TABLE instance_branding ADD COLUMN IF NOT EXISTS card_color text DEFAULT '#141414'",
  "ALTER TABLE instance_branding ADD COLUMN IF NOT EXISTS muted_color text DEFAULT '#1F1F1F'",
  "ALTER TABLE instance_branding ADD COLUMN IF NOT EXISTS border_color text DEFAULT '#2A2A2A'",
  "ALTER TABLE instance_branding ADD COLUMN IF NOT EXISTS sidebar_background_color text DEFAULT '#0F0F0F'",
  "ALTER TABLE instance_branding ADD COLUMN IF NOT EXISTS sidebar_foreground_color text DEFAULT '#A3A3A3'",
  "ALTER TABLE instance_branding ADD COLUMN IF NOT EXISTS light_palette jsonb",
] as const;

let ensured = false;

/** Idempotent guard so branding reads never 500 if migration lagged. */
export default async function ensureBrandingChromeColumns(): Promise<void> {
  if (ensured) {
    return;
  }
  for (const statement of ALTERS) {
    await db.execute(sql.raw(statement));
  }
  ensured = true;
}
