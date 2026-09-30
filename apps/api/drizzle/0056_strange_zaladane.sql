CREATE TABLE "data_migration" (
	"id" text PRIMARY KEY NOT NULL,
	"completed_at" timestamp DEFAULT now() NOT NULL
);
