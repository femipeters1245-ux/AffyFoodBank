-- backend/migrations/005_permanent_virtual_accounts_and_funding_events.sql
-- Additive migration for permanent TransactPay virtual accounts and durable funding event tracking

-- 1. Ensure VirtualAccount table has bankCode and unique constraints
ALTER TABLE IF EXISTS "VirtualAccount"
  ADD COLUMN IF NOT EXISTS "bankCode" VARCHAR(20);

CREATE UNIQUE INDEX IF NOT EXISTS "uq_virtual_account_account_number"
  ON "VirtualAccount" ("accountNumber");

CREATE UNIQUE INDEX IF NOT EXISTS "uq_virtual_account_alias"
  ON "VirtualAccount" ("alias")
  WHERE "alias" IS NOT NULL;

-- 2. Create durable WalletFundingEvent table for webhook buffering & state machine
CREATE TABLE IF NOT EXISTS "WalletFundingEvent" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "sessionId" VARCHAR(150) NOT NULL,
  "paymentReference" VARCHAR(150) NOT NULL,
  "accountReference" VARCHAR(150),
  "destinationAccountNumber" VARCHAR(30),
  "customerProfileId" UUID REFERENCES "CustomerProfile"("id") ON DELETE SET NULL,
  "rawPayload" JSONB NOT NULL,
  "status" VARCHAR(30) NOT NULL DEFAULT 'RECEIVED', -- RECEIVED, VERIFYING, CREDITED, FAILED, UNMATCHED, REJECTED
  "grossAmountCents" BIGINT,
  "feeCents" BIGINT DEFAULT 0,
  "netAmountCents" BIGINT,
  "currency" VARCHAR(5) DEFAULT 'NGN',
  "verifiedAt" TIMESTAMPTZ,
  "verificationPayload" JSONB,
  "failureReason" TEXT,
  "attempts" INT DEFAULT 0,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "uq_funding_event_session_id" UNIQUE ("sessionId"),
  CONSTRAINT "uq_funding_event_payment_ref" UNIQUE ("paymentReference")
);

-- 3. Enhance WalletTransaction to track gross and fee details
ALTER TABLE IF EXISTS "WalletTransaction"
  ADD COLUMN IF NOT EXISTS "grossAmountCents" BIGINT,
  ADD COLUMN IF NOT EXISTS "feeCents" BIGINT DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS "uq_wallet_tx_payment_ref"
  ON "WalletTransaction" ("paymentReference")
  WHERE "paymentReference" IS NOT NULL;

-- 4. Enable RLS
ALTER TABLE IF EXISTS "WalletFundingEvent" ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'WalletFundingEvent' AND policyname = 'Admins can view funding events'
  ) THEN
    CREATE POLICY "Admins can view funding events"
      ON "WalletFundingEvent" FOR SELECT
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'WalletFundingEvent' AND policyname = 'Service role manages funding events'
  ) THEN
    CREATE POLICY "Service role manages funding events"
      ON "WalletFundingEvent" FOR ALL
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;
