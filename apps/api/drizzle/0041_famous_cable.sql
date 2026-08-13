CREATE TABLE "trial_grant" (
	"email_hash" text PRIMARY KEY NOT NULL,
	"trial_ends_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
