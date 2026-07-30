CREATE TABLE "billing_event" (
	"id" text PRIMARY KEY NOT NULL,
	"event_type" text NOT NULL,
	"processed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspace_billing" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"founding_free" boolean DEFAULT false NOT NULL,
	"trial_ends_at" timestamp,
	"creem_customer_id" text,
	"creem_subscription_id" text,
	"creem_product_id" text,
	"plan" text,
	"billing_interval" text,
	"status" text,
	"seats" integer DEFAULT 1 NOT NULL,
	"current_period_end" timestamp,
	"canceled_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "workspace_billing_workspace_id_unique" UNIQUE("workspace_id"),
	CONSTRAINT "workspace_billing_creem_subscription_id_unique" UNIQUE("creem_subscription_id")
);
--> statement-breakpoint
ALTER TABLE "workspace_billing" ADD CONSTRAINT "workspace_billing_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "workspace_billing_workspaceId_idx" ON "workspace_billing" USING btree ("workspace_id");