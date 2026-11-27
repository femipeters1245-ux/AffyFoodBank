-- ================================================================
-- Migration 006: Coverage Zones, ADP Operator & Student-Partner Network
--
-- Rollback SQL:
-- DROP TABLE IF EXISTS "AdpEarning" CASCADE;
-- DROP TABLE IF EXISTS "AdpPayoutBatch" CASCADE;
-- DROP TABLE IF EXISTS "AdpCompensationRate" CASCADE;
-- DROP TABLE IF EXISTS "AdpVerificationHistory" CASCADE;
-- DROP TABLE IF EXISTS "AdpOperator" CASCADE;
-- DROP TABLE IF EXISTS "CoverageZone" CASCADE;
-- ALTER TABLE "Order" DROP COLUMN IF EXISTS "adpOperatorId";
-- ALTER TABLE "Order" DROP COLUMN IF EXISTS "adpSnapshot";
-- DELETE FROM "Role" WHERE "name" = 'AdpOperator';
-- ================================================================

-- 1. Coverage Zones
CREATE TABLE IF NOT EXISTS "CoverageZone" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" VARCHAR(100) NOT NULL,
  "normalizedName" VARCHAR(100) NOT NULL,
  "targetAdpCount" INT NOT NULL DEFAULT 2,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "uq_coverage_zone_normalized" UNIQUE ("normalizedName")
);

-- Index on normalized name and active status
CREATE INDEX IF NOT EXISTS "idx_coverage_zone_active" ON "CoverageZone" ("isActive");

-- 2. Idempotent Seed for the 13 official UNILESA Coverage Zones
INSERT INTO "CoverageZone" ("name", "normalizedName", "targetAdpCount", "isActive", "createdAt", "updatedAt")
VALUES
  ('NNPC', 'nnpc', 2, true, NOW(), NOW()),
  ('RCCG Mega', 'rccg mega', 2, true, NOW(), NOW()),
  ('Pedi', 'pedi', 2, true, NOW(), NOW()),
  ('Arimoro', 'arimoro', 2, true, NOW(), NOW()),
  ('Ido', 'ido', 2, true, NOW(), NOW()),
  ('O West', 'o west', 2, true, NOW(), NOW()),
  ('Ajibade', 'ajibade', 2, true, NOW(), NOW()),
  ('MichoDollar', 'michodollar', 2, true, NOW(), NOW()),
  ('Campus Gate', 'campus gate', 2, true, NOW(), NOW()),
  ('Olive Junction', 'olive junction', 2, true, NOW(), NOW()),
  ('Imola', 'imola', 2, true, NOW(), NOW()),
  ('Ibodi', 'ibodi', 2, true, NOW(), NOW()),
  ('Isua', 'isua', 2, true, NOW(), NOW())
ON CONFLICT ("normalizedName") DO UPDATE
SET "name" = EXCLUDED."name",
    "updatedAt" = NOW();

-- 3. Seed AdpOperator Role
INSERT INTO "Role" ("id", "name", "description", "createdAt", "updatedAt")
VALUES (gen_random_uuid(), 'AdpOperator', 'Affy Delivery Port student-partner operator', NOW(), NOW())
ON CONFLICT ("name") DO NOTHING;

-- 4. ADP Operators (Student-Partner Delivery Ports)
CREATE TABLE IF NOT EXISTS "AdpOperator" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "applicationReference" VARCHAR(50) NOT NULL,
  "userId" UUID NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT,
  "coverageZoneId" UUID NOT NULL REFERENCES "CoverageZone"("id") ON DELETE RESTRICT,
  
  -- Student Details
  "fullName" VARCHAR(150) NOT NULL,
  "matricNumber" VARCHAR(50) NOT NULL,
  "normalizedMatric" VARCHAR(50) NOT NULL,
  "institution" VARCHAR(150) NOT NULL DEFAULT 'University of Ilesa (UNILESA)',
  "faculty" VARCHAR(100) NOT NULL,
  "department" VARCHAR(100) NOT NULL,
  "academicLevel" VARCHAR(20) NOT NULL,
  "phone" VARCHAR(20) NOT NULL,
  "email" VARCHAR(150) NOT NULL,
  "studentIdDocPath" TEXT NOT NULL,
  
  -- Hostel / Location Details
  "hostelName" VARCHAR(150) NOT NULL,
  "hostelAddress" TEXT NOT NULL,
  "closestLandmark" VARCHAR(150),
  
  -- Encrypted Sensitive Payment Details
  "bankName" VARCHAR(100) NOT NULL,
  "bankCode" VARCHAR(20) NOT NULL,
  "accountNumberEncrypted" TEXT NOT NULL,
  "accountNumberMasked" VARCHAR(20) NOT NULL,
  "accountName" VARCHAR(150) NOT NULL,
  "nameEnquiryVerifiedName" VARCHAR(150),
  "alternativeContact" VARCHAR(50),
  
  -- Overall Status: PENDING_REVIEW, UNDER_VERIFICATION, INFO_REQUESTED, APPROVED, REJECTED, SUSPENDED, BLOCKED
  "status" VARCHAR(50) NOT NULL DEFAULT 'PENDING_REVIEW',
  
  -- Three Separate Verification Tracks (PENDING, APPROVED, REJECTED, INFO_REQUESTED, MANUAL_REVIEW)
  "studentVerificationStatus" VARCHAR(50) NOT NULL DEFAULT 'PENDING',
  "studentVerificationNotes" TEXT,
  "studentVerifiedBy" UUID REFERENCES "User"("id"),
  "studentVerifiedAt" TIMESTAMPTZ,
  
  "hostelVerificationStatus" VARCHAR(50) NOT NULL DEFAULT 'PENDING',
  "hostelVerificationNotes" TEXT,
  "hostelVerifiedBy" UUID REFERENCES "User"("id"),
  "hostelVerifiedAt" TIMESTAMPTZ,
  
  "paymentVerificationStatus" VARCHAR(50) NOT NULL DEFAULT 'PENDING',
  "paymentVerificationNotes" TEXT,
  "paymentVerifiedBy" UUID REFERENCES "User"("id"),
  "paymentVerifiedAt" TIMESTAMPTZ,
  
  -- Final Activation State
  "isActive" BOOLEAN NOT NULL DEFAULT false,
  "rejectionReason" TEXT,
  "suspensionReason" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT "uq_adp_operator_app_ref" UNIQUE ("applicationReference")
);

-- Unique constraint on active/pending normalized matriculation numbers
CREATE UNIQUE INDEX IF NOT EXISTS "uq_adp_active_matric"
ON "AdpOperator" ("normalizedMatric")
WHERE "status" NOT IN ('REJECTED');

-- Indexes on foreign keys and search paths
CREATE INDEX IF NOT EXISTS "idx_adp_operator_user" ON "AdpOperator" ("userId");
CREATE INDEX IF NOT EXISTS "idx_adp_operator_zone" ON "AdpOperator" ("coverageZoneId");
CREATE INDEX IF NOT EXISTS "idx_adp_operator_status" ON "AdpOperator" ("status");
CREATE INDEX IF NOT EXISTS "idx_adp_operator_active" ON "AdpOperator" ("isActive");

-- 5. ADP Verification & State Audit History
CREATE TABLE IF NOT EXISTS "AdpVerificationHistory" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "adpOperatorId" UUID NOT NULL REFERENCES "AdpOperator"("id") ON DELETE CASCADE,
  "track" VARCHAR(50) NOT NULL, -- 'STUDENT' | 'HOSTEL' | 'PAYMENT' | 'OVERALL'
  "oldStatus" VARCHAR(50) NOT NULL,
  "newStatus" VARCHAR(50) NOT NULL,
  "reason" TEXT,
  "officerUserId" UUID REFERENCES "User"("id"),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_adp_history_operator" ON "AdpVerificationHistory" ("adpOperatorId");

-- 6. ADP Compensation Configuration Rates
CREATE TABLE IF NOT EXISTS "AdpCompensationRate" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "coverageZoneId" UUID REFERENCES "CoverageZone"("id") ON DELETE CASCADE,
  "ratePerCollectionCents" BIGINT NOT NULL,
  "effectiveFrom" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdBy" UUID REFERENCES "User"("id"),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Operator Earnings (One earning per verified completed collection)
CREATE TABLE IF NOT EXISTS "AdpEarning" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "orderId" UUID NOT NULL REFERENCES "Order"("id") ON DELETE RESTRICT,
  "adpOperatorId" UUID NOT NULL REFERENCES "AdpOperator"("id") ON DELETE RESTRICT,
  "amountCents" BIGINT NOT NULL,
  "rateUsedCents" BIGINT NOT NULL,
  "coverageZoneId" UUID NOT NULL REFERENCES "CoverageZone"("id"),
  "status" VARCHAR(50) NOT NULL DEFAULT 'PENDING', -- 'PENDING' | 'APPROVED' | 'PAID' | 'ADJUSTED'
  "payoutBatchId" UUID,
  "collectedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "uq_adp_earning_order" UNIQUE ("orderId")
);

CREATE INDEX IF NOT EXISTS "idx_adp_earning_operator" ON "AdpEarning" ("adpOperatorId");
CREATE INDEX IF NOT EXISTS "idx_adp_earning_status" ON "AdpEarning" ("status");
CREATE INDEX IF NOT EXISTS "idx_adp_earning_batch" ON "AdpEarning" ("payoutBatchId");

-- 8. Payout Batches
CREATE TABLE IF NOT EXISTS "AdpPayoutBatch" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "batchReference" VARCHAR(50) NOT NULL,
  "adpOperatorId" UUID NOT NULL REFERENCES "AdpOperator"("id") ON DELETE RESTRICT,
  "totalAmountCents" BIGINT NOT NULL,
  "earningsCount" INT NOT NULL,
  "status" VARCHAR(50) NOT NULL DEFAULT 'PENDING', -- 'PENDING' | 'SUCCESSFUL' | 'FAILED'
  "channel" VARCHAR(50) NOT NULL DEFAULT 'MANUAL', -- 'TRANSACTPAY' | 'MANUAL'
  "clientReference" VARCHAR(100),
  "paymentReference" VARCHAR(100),
  "processedBy" UUID REFERENCES "User"("id"),
  "paidAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "uq_adp_payout_batch_ref" UNIQUE ("batchReference"),
  CONSTRAINT "uq_adp_payout_client_ref" UNIQUE ("clientReference")
);

-- 9. Add Order permanent ADP snapshot columns
ALTER TABLE "Order"
ADD COLUMN IF NOT EXISTS "adpOperatorId" UUID REFERENCES "AdpOperator"("id"),
ADD COLUMN IF NOT EXISTS "adpSnapshot" JSONB;
