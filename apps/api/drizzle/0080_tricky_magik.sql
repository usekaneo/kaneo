CREATE TABLE "ai_ledger" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"source" text NOT NULL,
	"kind" text NOT NULL,
	"amount" bigint NOT NULL,
	"run_id" text,
	"model" text,
	"created_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL,
	CONSTRAINT "ai_ledger_source_unique" UNIQUE("source")
);
--> statement-breakpoint
CREATE TABLE "ai_payment_reversal" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text,
	"checkout_id" text,
	"transaction_id" text,
	"cents" integer,
	"currency" text NOT NULL,
	"applied" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_reservation" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"run_id" text NOT NULL,
	"model" text NOT NULL,
	"amount" bigint NOT NULL,
	"multiplier_bps" integer NOT NULL,
	"generation_id" text,
	"status" text DEFAULT 'held' NOT NULL,
	"created_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL,
	CONSTRAINT "ai_reservation_generation_id_unique" UNIQUE("generation_id")
);
--> statement-breakpoint
CREATE TABLE "ai_topup" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"user_id" text NOT NULL,
	"request_id" text NOT NULL,
	"product_id" text NOT NULL,
	"cents" integer NOT NULL,
	"refunded_cents" integer DEFAULT 0 NOT NULL,
	"refunded_paid_cents" integer DEFAULT 0 NOT NULL,
	"checkout_id" text,
	"order_id" text,
	"transaction_id" text,
	"paid_cents" integer,
	"checkout_url" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL,
	CONSTRAINT "ai_topup_checkout_id_unique" UNIQUE("checkout_id"),
	CONSTRAINT "ai_topup_order_id_unique" UNIQUE("order_id"),
	CONSTRAINT "ai_topup_transaction_id_unique" UNIQUE("transaction_id"),
	CONSTRAINT "ai_topup_request_unique" UNIQUE("workspace_id","request_id")
);
--> statement-breakpoint
CREATE TABLE "ai_trial_claim" (
	"email_hash" text PRIMARY KEY NOT NULL,
	"created_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_wallet" (
	"workspace_id" text PRIMARY KEY NOT NULL,
	"balance" bigint DEFAULT 0 NOT NULL,
	"reserved" bigint DEFAULT 0 NOT NULL,
	"trial_granted" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_ledger" ADD CONSTRAINT "ai_ledger_workspace_id_ai_wallet_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."ai_wallet"("workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_reservation" ADD CONSTRAINT "ai_reservation_workspace_id_ai_wallet_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."ai_wallet"("workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_topup" ADD CONSTRAINT "ai_topup_workspace_id_ai_wallet_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."ai_wallet"("workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_wallet" ADD CONSTRAINT "ai_wallet_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_ledger_workspace_created_idx" ON "ai_ledger" USING btree ("workspace_id","created_at");--> statement-breakpoint
CREATE INDEX "ai_reservation_status_created_idx" ON "ai_reservation" USING btree ("status","created_at");