-- backend/migrations/004_wallet_payout_and_virtual_accounts.sql
-- Additive migration for TransactPay virtual accounts and withdrawal reservations

-- 1. Add reservedWithdrawalCents to Wallet for atomic fund reservation
ALTER TABLE IF EXISTS "Wallet" 
ADD COLUMN IF NOT EXISTS "reservedWithdrawalCents" BIGINT NOT NULL DEFAULT 0;

-- 2. Create VirtualAccount table to persistently bind accounts to customer profiles
CREATE TABLE IF NOT EXISTS "VirtualAccount" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "customerProfileId" UUID NOT NULL REFERENCES "CustomerProfile"("id") ON DELETE CASCADE,
  "accountNumber" VARCHAR(20) NOT NULL,
  "bankName" VARCHAR(100) NOT NULL,
  "accountName" VARCHAR(150) NOT NULL,
  "accountReference" VARCHAR(100) NOT NULL UNIQUE,
  "alias" VARCHAR(100),
  "currency" VARCHAR(5) NOT NULL DEFAULT 'NGN',
  "provider" VARCHAR(50) NOT NULL DEFAULT 'TRANSACTPAY',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "uq_virtual_account_customer" UNIQUE ("customerProfileId")
);

-- 3. Add providerSessionId and providerReference to WalletTransaction for idempotency
ALTER TABLE IF EXISTS "WalletTransaction"
ADD COLUMN IF NOT EXISTS "providerSessionId" VARCHAR(150),
ADD COLUMN IF NOT EXISTS "providerReference" VARCHAR(150);

CREATE UNIQUE INDEX IF NOT EXISTS "uq_wallet_tx_provider_session" 
ON "WalletTransaction" ("providerSessionId") 
WHERE "providerSessionId" IS NOT NULL;

-- 4. Enable RLS
ALTER TABLE IF EXISTS "VirtualAccount" ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'VirtualAccount' AND policyname = 'Customers can view their own virtual account'
  ) THEN
    CREATE POLICY "Customers can view their own virtual account"
      ON "VirtualAccount" FOR SELECT
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'VirtualAccount' AND policyname = 'Service role manages virtual accounts'
  ) THEN
    CREATE POLICY "Service role manages virtual accounts"
      ON "VirtualAccount" FOR ALL
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;
