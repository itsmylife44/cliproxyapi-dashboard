-- CreateIndex
CREATE INDEX IF NOT EXISTS "audit_logs_target_idx" ON "audit_logs"("target");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "usage_records_source_idx" ON "usage_records"("source");
