-- IF NOT EXISTS: an early draft of 0064 created this index on some dev and
-- test databases before it moved here.
CREATE INDEX IF NOT EXISTS "task_completed_at_idx" ON "task" USING btree ("completed_at");