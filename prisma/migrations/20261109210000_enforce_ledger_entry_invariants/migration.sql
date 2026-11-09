DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'LedgerEntry_sides_valid'
      AND conrelid = 'public."LedgerEntry"'::regclass
  ) THEN
    ALTER TABLE "LedgerEntry"
      ADD CONSTRAINT "LedgerEntry_sides_valid"
      CHECK (
        "debit" >= 0
        AND "credit" >= 0
        AND (("debit" > 0 AND "credit" = 0) OR ("debit" = 0 AND "credit" > 0))
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'LedgerEntry_account_valid'
      AND conrelid = 'public."LedgerEntry"'::regclass
  ) THEN
    ALTER TABLE "LedgerEntry"
      ADD CONSTRAINT "LedgerEntry_account_valid"
      CHECK ("account" IN (
        'STUDENT_WALLET',
        'VENDOR_PENDING',
        'PLATFORM_REVENUE',
        'UNIVERSITY_REVENUE',
        'AGGREGATOR_PAYABLE',
        'CASH_TRUST',
        'TEST_PAYMENT_CLEARING',
        'TEST_ORDER_ENTITLEMENT',
        'TEST_VENDOR_CHARGE',
        'TEST_SUPPORT_FEE_REVENUE'
      ));
  END IF;
END $$;
