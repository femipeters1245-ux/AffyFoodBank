-- backend/migrations/007_adp_rls_and_security_audit.sql
-- Milestone 9: Row-Level Security (RLS) & Access Control Audit for ADP System

-- 1. Enable RLS on all ADP-related tables
ALTER TABLE IF EXISTS "CoverageZone" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "AdpOperator" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "AdpVerificationHistory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "AdpCompensationRate" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "AdpEarning" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "AdpPayoutBatch" ENABLE ROW LEVEL SECURITY;

-- 2. CoverageZone Policies
-- Active zones are publicly visible for order checkout and application dropdowns
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'CoverageZone' AND policyname = 'Public read active coverage zones'
  ) THEN
    CREATE POLICY "Public read active coverage zones"
      ON "CoverageZone" FOR SELECT
      USING ("isActive" = true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'CoverageZone' AND policyname = 'Service role manages coverage zones'
  ) THEN
    CREATE POLICY "Service role manages coverage zones"
      ON "CoverageZone" FOR ALL
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- 3. AdpOperator Policies
-- Operators can read their own profile; applicants can insert their own application;
-- Service role (backend) manages all operators and verifies data
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'AdpOperator' AND policyname = 'Operators can view own profile'
  ) THEN
    CREATE POLICY "Operators can view own profile"
      ON "AdpOperator" FOR SELECT
      USING (auth.uid() = "userId");
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'AdpOperator' AND policyname = 'Applicants can submit application'
  ) THEN
    CREATE POLICY "Applicants can submit application"
      ON "AdpOperator" FOR INSERT
      WITH CHECK (auth.uid() = "userId");
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'AdpOperator' AND policyname = 'Service role manages all operators'
  ) THEN
    CREATE POLICY "Service role manages all operators"
      ON "AdpOperator" FOR ALL
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- 4. AdpVerificationHistory Policies
-- Operators can view audit track logs belonging to their operator record; Service role manages all
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'AdpVerificationHistory' AND policyname = 'Operators can view own verification history'
  ) THEN
    CREATE POLICY "Operators can view own verification history"
      ON "AdpVerificationHistory" FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM "AdpOperator" op
          WHERE op.id = "AdpVerificationHistory"."adpOperatorId"
            AND op."userId" = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'AdpVerificationHistory' AND policyname = 'Service role manages verification history'
  ) THEN
    CREATE POLICY "Service role manages verification history"
      ON "AdpVerificationHistory" FOR ALL
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- 5. AdpCompensationRate Policies
-- Authenticated users can view rates; Service role manages rates
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'AdpCompensationRate' AND policyname = 'Authenticated users can view compensation rates'
  ) THEN
    CREATE POLICY "Authenticated users can view compensation rates"
      ON "AdpCompensationRate" FOR SELECT
      USING (auth.role() = 'authenticated');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'AdpCompensationRate' AND policyname = 'Service role manages compensation rates'
  ) THEN
    CREATE POLICY "Service role manages compensation rates"
      ON "AdpCompensationRate" FOR ALL
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- 6. AdpEarning Policies
-- Operators can view their own earnings only; Service role manages all earnings
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'AdpEarning' AND policyname = 'Operators can view own earnings'
  ) THEN
    CREATE POLICY "Operators can view own earnings"
      ON "AdpEarning" FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM "AdpOperator" op
          WHERE op.id = "AdpEarning"."adpOperatorId"
            AND op."userId" = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'AdpEarning' AND policyname = 'Service role manages all earnings'
  ) THEN
    CREATE POLICY "Service role manages all earnings"
      ON "AdpEarning" FOR ALL
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- 7. AdpPayoutBatch Policies
-- Operators can view their own payout batches; Service role manages all batches
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'AdpPayoutBatch' AND policyname = 'Operators can view own payout batches'
  ) THEN
    CREATE POLICY "Operators can view own payout batches"
      ON "AdpPayoutBatch" FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM "AdpOperator" op
          WHERE op.id = "AdpPayoutBatch"."adpOperatorId"
            AND op."userId" = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'AdpPayoutBatch' AND policyname = 'Service role manages all payout batches'
  ) THEN
    CREATE POLICY "Service role manages all payout batches"
      ON "AdpPayoutBatch" FOR ALL
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;
