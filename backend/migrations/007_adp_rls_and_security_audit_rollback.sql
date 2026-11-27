-- backend/migrations/007_adp_rls_and_security_audit_rollback.sql
-- Rollback for Milestone 9: Row-Level Security (RLS) & Access Control Audit

-- 1. Drop Policies
DROP POLICY IF EXISTS "Public read active coverage zones" ON "CoverageZone";
DROP POLICY IF EXISTS "Service role manages coverage zones" ON "CoverageZone";

DROP POLICY IF EXISTS "Operators can view own profile" ON "AdpOperator";
DROP POLICY IF EXISTS "Applicants can submit application" ON "AdpOperator";
DROP POLICY IF EXISTS "Service role manages all operators" ON "AdpOperator";

DROP POLICY IF EXISTS "Operators can view own verification history" ON "AdpVerificationHistory";
DROP POLICY IF EXISTS "Service role manages verification history" ON "AdpVerificationHistory";

DROP POLICY IF EXISTS "Authenticated users can view compensation rates" ON "AdpCompensationRate";
DROP POLICY IF EXISTS "Service role manages compensation rates" ON "AdpCompensationRate";

DROP POLICY IF EXISTS "Operators can view own earnings" ON "AdpEarning";
DROP POLICY IF EXISTS "Service role manages all earnings" ON "AdpEarning";

DROP POLICY IF EXISTS "Operators can view own payout batches" ON "AdpPayoutBatch";
DROP POLICY IF EXISTS "Service role manages all payout batches" ON "AdpPayoutBatch";

-- 2. Disable RLS
ALTER TABLE IF EXISTS "CoverageZone" DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "AdpOperator" DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "AdpVerificationHistory" DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "AdpCompensationRate" DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "AdpEarning" DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "AdpPayoutBatch" DISABLE ROW LEVEL SECURITY;
