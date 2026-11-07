-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN "isTest" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Order"
ADD COLUMN "creditApplied" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "testOnly" BOOLEAN NOT NULL DEFAULT false;

-- Orders created before the internal test API did not have a durable test marker.
-- Their old payment path was simulated, so keep them out of live-money/refund paths.
UPDATE "Order" SET "testOnly" = true WHERE "transactionId" IS NOT NULL;
UPDATE "Transaction" AS t
SET "isTest" = true
WHERE t."type" = 'PAYMENT'
  AND EXISTS (SELECT 1 FROM "Order" AS o WHERE o."transactionId" = t."id");

-- CreateTable
CREATE TABLE "PaymentEvent" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "stage" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'KUPO_TEST_API',
    "actorId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PaymentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CafeteriaCredit" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "isTest" BOOLEAN NOT NULL DEFAULT false,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CafeteriaCredit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditRequest" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "universityId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "vendorNote" TEXT,
    "reviewedById" TEXT,
    "vendorReviewedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CreditRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditMovement" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "creditId" TEXT NOT NULL,
    "creditRequestId" TEXT,
    "orderId" TEXT,
    "kind" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CreditMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportTicket" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "creditRequestId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "universityId" TEXT NOT NULL,
    "feeAmount" INTEGER NOT NULL DEFAULT 1500,
    "feeTransactionId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "reason" TEXT NOT NULL,
    "adminNote" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SupportTicket_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PaymentEvent_transactionId_createdAt_idx" ON "PaymentEvent"("transactionId", "createdAt");
CREATE UNIQUE INDEX "PaymentEvent_transactionId_sequence_key" ON "PaymentEvent"("transactionId", "sequence");
CREATE INDEX "CafeteriaCredit_vendorId_balance_idx" ON "CafeteriaCredit"("vendorId", "balance");
CREATE UNIQUE INDEX "CafeteriaCredit_studentId_vendorId_isTest_key" ON "CafeteriaCredit"("studentId", "vendorId", "isTest");
CREATE UNIQUE INDEX "CreditRequest_reference_key" ON "CreditRequest"("reference");
CREATE UNIQUE INDEX "CreditRequest_orderId_key" ON "CreditRequest"("orderId");
CREATE INDEX "CreditRequest_universityId_status_createdAt_idx" ON "CreditRequest"("universityId", "status", "createdAt");
CREATE INDEX "CreditRequest_vendorId_status_createdAt_idx" ON "CreditRequest"("vendorId", "status", "createdAt");
CREATE INDEX "CreditRequest_studentId_createdAt_idx" ON "CreditRequest"("studentId", "createdAt");
CREATE UNIQUE INDEX "CreditMovement_reference_key" ON "CreditMovement"("reference");
CREATE UNIQUE INDEX "CreditMovement_creditRequestId_key" ON "CreditMovement"("creditRequestId");
CREATE INDEX "CreditMovement_creditId_createdAt_idx" ON "CreditMovement"("creditId", "createdAt");
CREATE INDEX "CreditMovement_orderId_kind_idx" ON "CreditMovement"("orderId", "kind");
CREATE UNIQUE INDEX "SupportTicket_reference_key" ON "SupportTicket"("reference");
CREATE UNIQUE INDEX "SupportTicket_creditRequestId_key" ON "SupportTicket"("creditRequestId");
CREATE UNIQUE INDEX "SupportTicket_feeTransactionId_key" ON "SupportTicket"("feeTransactionId");
CREATE INDEX "SupportTicket_universityId_status_createdAt_idx" ON "SupportTicket"("universityId", "status", "createdAt");
CREATE INDEX "SupportTicket_vendorId_createdAt_idx" ON "SupportTicket"("vendorId", "createdAt");

-- AddForeignKey
ALTER TABLE "PaymentEvent" ADD CONSTRAINT "PaymentEvent_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaymentEvent" ADD CONSTRAINT "PaymentEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CafeteriaCredit" ADD CONSTRAINT "CafeteriaCredit_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CafeteriaCredit" ADD CONSTRAINT "CafeteriaCredit_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CreditRequest" ADD CONSTRAINT "CreditRequest_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CreditRequest" ADD CONSTRAINT "CreditRequest_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CreditRequest" ADD CONSTRAINT "CreditRequest_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CreditRequest" ADD CONSTRAINT "CreditRequest_universityId_fkey" FOREIGN KEY ("universityId") REFERENCES "University"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CreditRequest" ADD CONSTRAINT "CreditRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CreditMovement" ADD CONSTRAINT "CreditMovement_creditId_fkey" FOREIGN KEY ("creditId") REFERENCES "CafeteriaCredit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CreditMovement" ADD CONSTRAINT "CreditMovement_creditRequestId_fkey" FOREIGN KEY ("creditRequestId") REFERENCES "CreditRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CreditMovement" ADD CONSTRAINT "CreditMovement_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_creditRequestId_fkey" FOREIGN KEY ("creditRequestId") REFERENCES "CreditRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_universityId_fkey" FOREIGN KEY ("universityId") REFERENCES "University"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
