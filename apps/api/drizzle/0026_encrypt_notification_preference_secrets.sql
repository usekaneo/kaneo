UPDATE "user_notification_preference"
SET "ntfy_token" = NULL
WHERE "ntfy_token" IS NOT NULL
  AND "ntfy_token" NOT LIKE 'enc:v1:%';
--> statement-breakpoint
UPDATE "user_notification_preference"
SET "gotify_token" = NULL
WHERE "gotify_token" IS NOT NULL
  AND "gotify_token" NOT LIKE 'enc:v1:%';
--> statement-breakpoint
UPDATE "user_notification_preference"
SET "webhook_secret" = NULL
WHERE "webhook_secret" IS NOT NULL
  AND "webhook_secret" NOT LIKE 'enc:v1:%';
