import { quillsSchema, workspaceColumn, workspacePolicy } from "../tenancy";
import { primaryKey } from "drizzle-orm/pg-core";
/**
 * Email channel accounts (support platform §4.8 Layer 2). `channelAccounts` holds
 * two row roles for email — one `inbound` route per workspace (the front door,
 * config in JSONB) that a conversation's `channel_account_id` points at, and N
 * `sending` addresses (the verified From identities per module). `emailSendingDomains`
 * are the SPF/DKIM-verified domains a sending address belongs to. Per-workspace DB
 * connection, so no workspace column. Inert until the cold-inbound/outbound slices.
 */
import {
  text,
  jsonb,
  timestamp,
  index,
  uniqueIndex,
  foreignKey,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import {
  typeIdWithDefault,
  typeIdColumn,
  typeIdColumnNullable,
} from "@kaneo/ids/drizzle";
import { teams } from "./teams";

/**
 * What a published record proves.
 *
 * `ownership` is ours and the other two are the mail provider's, which is the
 * whole reason the purposes are enumerated rather than left as prose. A provider
 * that can sign for a domain it does not host will report that domain verified
 * to anyone who asks, including a workspace that does not own it — so a record
 * only this workspace could have published is the one thing that ties the domain
 * to the workspace. See the sending-identity module for the split.
 */
export type SendingDomainRecordPurpose = "ownership" | "dkim" | "mail-from";

/**
 * What our own lookup found for one record, the last time it looked.
 *
 * Explanation, not authority: the mail provider decides whether a domain is
 * verified, and this only says which record is holding it up and why.
 */
export interface SendingDomainRecordCheck {
  state: "found" | "missing" | "mismatch" | "proxied";
  /** What we resolved, when it differs from what we asked for. */
  seen?: string;
  /**
   * Why a mismatch is one, when there is a name for it. `doubled-name` means
   * the record was found under the domain written twice
   * (`_quackback.acme.com.acme.com`), the form a DNS host produces when the
   * full name is typed into a field that appends the domain itself.
   * `truncated` means the value found is the start of the wanted one and no
   * more, the form a DNS host that caps a value's length produces; `quoted`
   * means the value carries literal quote marks, from parts pasted into a host
   * that stores them as typed.
   */
  reason?: "doubled-name" | "truncated" | "quoted";
  /** ISO timestamp of the lookup. */
  checkedAt: string;
}

/**
 * A DNS record the domain's owner must publish before we can send as it.
 *
 * A union rather than one shape with optional fields, because an MX record
 * carries a preference number and the other two carry nothing of the sort:
 * making `priority` optional everywhere would let a CNAME be written with one
 * and an MX be written without, and the renderer would have no way to know
 * which of those it was looking at. Discriminating on `type` means the compiler
 * answers that question instead.
 *
 * `host` is RELATIVE to the domain, with `@` meaning the apex — the form a DNS
 * provider's form field expects, and the form the record checker resolves
 * against.
 */
export type SendingDomainDnsRecord =
  | SendingDomainOwnershipRecord
  | SendingDomainKeyRecord
  | {
      type: "TXT" | "CNAME";
      host: string;
      value: string;
      purpose: SendingDomainRecordPurpose;
      check?: SendingDomainRecordCheck;
    }
  | {
      type: "MX";
      host: string;
      value: string;
      /** RFC 5321 preference. Lower is preferred; a single MX is conventionally 10. */
      priority: number;
      purpose: SendingDomainRecordPurpose;
      check?: SendingDomainRecordCheck;
    };

/**
 * The one record in the set whose value is unique to a single row.
 *
 * Separated from the union so the checker that answers "does this workspace own
 * this zone" can demand it by type. Every other record in the set is a value we
 * publish in our instructions and therefore identical for every workspace that
 * follows them, so accepting one as proof would verify a domain for whoever
 * published our records rather than for whoever owns the domain.
 */
export interface SendingDomainOwnershipRecord {
  type: "TXT";
  host: string;
  value: string;
  purpose: "ownership";
  check?: SendingDomainRecordCheck;
}

/**
 * The public half of a signing key minted for one row: a TXT at
 * `<selector>._domainkey` carrying `v=DKIM1; k=rsa; p=<key>`.
 *
 * Unique to its row (a fresh key and selector each time), so unlike a DKIM
 * CNAME or the MAIL FROM records it is something only the workspace that holds
 * the row could have published, and it proves ownership in place of the
 * `_quackback` token on rows set up this way.
 */
export interface SendingDomainKeyRecord {
  type: "TXT";
  host: string;
  value: string;
  purpose: "dkim";
  check?: SendingDomainRecordCheck;
}

/** A record whose value exists in one row only, and so can prove ownership. */
export type SendingDomainProofRecord =
  | SendingDomainOwnershipRecord
  | SendingDomainKeyRecord;

/**
 * How a domain is signed.
 *
 * - `easy`: the provider's own keys, published as three DKIM CNAMEs, with the
 *   `_quackback` TXT as ownership proof. Rows set up before `byo` existed.
 * - `byo`: a key minted for the row, published as one TXT that also proves
 *   ownership.
 * - `shared`: the identity already existed when the row was added, so it keeps
 *   signing with the key it had. The row's own key TXT proves ownership only,
 *   and the records the identity signs with are listed beside it when they are
 *   the provider's CNAMEs. When that key was supplied elsewhere and does not
 *   verify, the row holds its own key (`pendingSigningKey`) and becomes `byo`
 *   once it proves ownership and the identity is re-keyed to it.
 */
export type SendingDomainDkimMode = "easy" | "byo" | "shared";

/**
 * What was learned about a domain's DNS before its identity was created, and
 * refreshed (the DMARC part) on each check. Read to tailor the setup steps;
 * nothing here decides whether the domain is verified.
 */
export interface SendingDomainPreflight {
  /** The DNS host the domain's nameservers belong to, matched by suffix. */
  dnsHost?:
    | "cloudflare"
    | "route53"
    | "godaddy"
    | "namecheap"
    | "google"
    | "other";
  /** Whether nothing resolved at the MAIL FROM subdomain before we used it. */
  mailFromFree?: boolean;
  /** The domain's DMARC record, read and never required. */
  dmarc?: { found: boolean; policy?: "none" | "quarantine" | "reject" };
  /** ISO timestamp of the lookups. */
  checkedAt?: string;
}

export const emailSendingDomains = quillsSchema
  .table(
    "email_sending_domains",
    {
      workspaceId: workspaceColumn(),
      id: typeIdWithDefault("sending_domain")("id").notNull(),
      owningTeamId: typeIdColumn("team")("owning_team_id").notNull(),
      domain: text("domain").notNull(),
      status: text("status", { enum: ["pending", "verified", "failed"] })
        .notNull()
        .default("pending"),
      dnsRecords: jsonb("dns_records")
        .$type<SendingDomainDnsRecord[]>()
        .notNull()
        .default(sql`'[]'::jsonb`),
      verifiedAt: timestamp("verified_at", { withTimezone: true }),
      dkimMode: text("dkim_mode")
        .$type<SendingDomainDkimMode>()
        .notNull()
        .default("easy"),
      lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
      /**
       * The MAIL FROM subdomain label. Stored per row because it changed:
       * domains verified before it was stored keep `bounce`, the column default,
       * and new rows are written with `qb-bounce`.
       */
      mailFromLabel: text("mail_from_label").notNull().default("bounce"),
      /** Until when a pending domain is checked automatically. Null: not in a window. */
      autoCheckUntil: timestamp("auto_check_until", { withTimezone: true }),
      preflight: jsonb("preflight")
        .$type<SendingDomainPreflight>()
        .notNull()
        .default(sql`'{}'::jsonb`),
      /**
       * The row's own private signing key, encrypted, held only while the
       * identity it joined signs with a key nobody can publish. Used once, to
       * re-key the identity after this row proves ownership, then cleared. Never
       * returned, logged or sent anywhere else.
       */
      pendingSigningKey: text("pending_signing_key"),
      createdAt: timestamp("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
      updatedAt: timestamp("updated_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
    },
    (table) => [
      uniqueIndex("email_sending_domains_team_domain_unique").on(
        table.workspaceId,
        table.owningTeamId,
        table.domain,
      ),
      foreignKey({
        name: "email_sending_domains_owning_team_id_fkey",
        columns: [table.workspaceId, table.owningTeamId],
        foreignColumns: [teams.workspaceId, teams.id],
      }).onDelete("cascade"),
      primaryKey({ columns: [table.workspaceId, table.id] }),
      workspacePolicy(table.workspaceId),
    ],
  )
  .enableRLS();

/** JSONB config, role-shaped: inbound routes carry the transport + poll cursor;
 *  sending addresses carry their optional per-address SMTP override. */
export interface ChannelAccountConfig {
  // inbound role
  forwardingTarget?: string;
  /** Which front door delivers this route's mail. `cloudflare` is the shared
   *  inbound domain a fleet answers behind one edge mail bridge; the other two
   *  are a per-workspace provider webhook and a polled mailbox. Free to grow: a
   *  jsonb column with no CHECK on it, so the union is the only thing enforcing
   *  the vocabulary and widening it is a type change, not a migration. */
  provider?: "imap" | "resend" | "cloudflare";
  imap?: { host: string; port: number; secure: boolean; user: string };
  cursor?: { uidValidity: number; lastUid: number };
  // sending role
  smtp?: { host: string; port: number; secure: boolean; user: string };
  // connection role: reference to an integration-framework credential.
  // Secrets stay on the integration row, never in this JSONB.
  integrationId?: string;
}

export const channelAccounts = quillsSchema
  .table(
    "channel_accounts",
    {
      workspaceId: workspaceColumn(),
      id: typeIdWithDefault("channel_account")("id").notNull(),
      owningTeamId: typeIdColumn("team")("owning_team_id").notNull(),
      channel: text("channel").notNull().default("email"),
      role: text("role", {
        enum: ["inbound", "sending", "connection"],
      }).notNull(),
      address: text("address"),
      module: text("module", { enum: ["support", "feedback", "changelog"] }),
      sendingDomainId:
        typeIdColumnNullable("sending_domain")("sending_domain_id"),
      config: jsonb("config")
        .$type<ChannelAccountConfig>()
        .notNull()
        .default(sql`'{}'::jsonb`),
      inboundTrust: text("inbound_trust", { enum: ["strict", "lenient"] })
        .notNull()
        .default("strict"),
      createdAt: timestamp("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
      updatedAt: timestamp("updated_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
      deletedAt: timestamp("deleted_at", { withTimezone: true }),
    },
    (table) => [
      check(
        "channel_accounts_role_check",
        sql`${table.role} IN ('inbound','sending','connection')`,
      ),
      foreignKey({
        name: "channel_accounts_owning_team_id_fkey",
        columns: [table.workspaceId, table.owningTeamId],
        foreignColumns: [teams.workspaceId, teams.id],
      }).onDelete("cascade"),
      foreignKey({
        name: "channel_accounts_sending_domain_id_fkey",
        columns: [table.workspaceId, table.sendingDomainId],
        foreignColumns: [
          emailSendingDomains.workspaceId,
          emailSendingDomains.id,
        ],
      }).onDelete("restrict"),
      // One inbound route per workspace (v1); relax when multi-inbox lands.
      uniqueIndex("channel_accounts_one_inbound_uq")
        .on(table.workspaceId, table.owningTeamId)
        .where(
          sql`role = 'inbound' AND channel = 'email' AND deleted_at IS NULL`,
        ),
      // One live GitHub inbox connection per workspace (v1, one repo).
      uniqueIndex("channel_accounts_one_github_connection_uq")
        .on(table.workspaceId, table.owningTeamId)
        .where(
          sql`role = 'connection' AND channel = 'github' AND deleted_at IS NULL`,
        ),
      // A sending address is unique per team + channel.
      uniqueIndex("channel_accounts_sending_address_uq")
        .on(table.workspaceId, table.owningTeamId, table.channel, table.address)
        .where(sql`address IS NOT NULL AND deleted_at IS NULL`),
      index("channel_accounts_team_role_idx")
        .on(table.owningTeamId, table.role)
        .where(sql`deleted_at IS NULL`),
      primaryKey({ columns: [table.workspaceId, table.id] }),
      workspacePolicy(table.workspaceId),
    ],
  )
  .enableRLS();

export type ChannelAccount = typeof channelAccounts.$inferSelect;
export type EmailSendingDomain = typeof emailSendingDomains.$inferSelect;
