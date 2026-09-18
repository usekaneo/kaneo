ALTER TABLE "payroll_item" ADD COLUMN "overtime_rate" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "payroll_item" ADD COLUMN "overtime_auto_amount" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
-- Existing lines were never edited: their amount is the automatic one, and
-- the rate is what that amount works out to per overtime hour.
UPDATE "payroll_item" SET
  "overtime_auto_amount" = "overtime_amount",
  "overtime_rate" = CASE
    WHEN "overtime_minutes" > 0 THEN round("overtime_amount" * 60.0 / "overtime_minutes")
    ELSE 0
  END;
