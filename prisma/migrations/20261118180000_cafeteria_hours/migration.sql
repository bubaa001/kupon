-- Cafeteria opening hours (Tanzania time) and why an order expired.
ALTER TABLE "Vendor" ADD COLUMN IF NOT EXISTS "openTime" TEXT;
ALTER TABLE "Vendor" ADD COLUMN IF NOT EXISTS "closeTime" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "expiryReason" TEXT;
