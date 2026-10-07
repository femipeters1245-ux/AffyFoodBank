-- Migration to enforce unique transaction reference for wallet_transactions
-- This ensures idempotent deposits/withdrawals and prevents duplicate processing.

CREATE UNIQUE INDEX IF NOT EXISTS idx_wallet_transactions_reference
ON wallet_transactions (reference);
