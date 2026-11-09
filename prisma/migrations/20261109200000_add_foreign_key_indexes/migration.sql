CREATE INDEX IF NOT EXISTS "VendorApplication_universityId_idx"
  ON "VendorApplication"("universityId");
CREATE INDEX IF NOT EXISTS "TeamInvite_universityId_idx"
  ON "TeamInvite"("universityId");
CREATE INDEX IF NOT EXISTS "TeamInvite_createdById_idx"
  ON "TeamInvite"("createdById");
CREATE INDEX IF NOT EXISTS "Order_verifiedById_idx"
  ON "Order"("verifiedById");
CREATE INDEX IF NOT EXISTS "OrderItem_menuItemId_idx"
  ON "OrderItem"("menuItemId");
CREATE INDEX IF NOT EXISTS "PaymentEvent_actorId_idx"
  ON "PaymentEvent"("actorId");
CREATE INDEX IF NOT EXISTS "CreditRequest_reviewedById_idx"
  ON "CreditRequest"("reviewedById");
CREATE INDEX IF NOT EXISTS "SupportTicket_orderId_idx"
  ON "SupportTicket"("orderId");
CREATE INDEX IF NOT EXISTS "SupportTicket_studentId_idx"
  ON "SupportTicket"("studentId");
CREATE INDEX IF NOT EXISTS "SupportTicket_reviewedById_idx"
  ON "SupportTicket"("reviewedById");
CREATE INDEX IF NOT EXISTS "RefundRequest_transactionId_idx"
  ON "RefundRequest"("transactionId");
CREATE INDEX IF NOT EXISTS "RefundRequest_reviewedById_idx"
  ON "RefundRequest"("reviewedById");
CREATE INDEX IF NOT EXISTS "OtpCode_universityId_idx"
  ON "OtpCode"("universityId");
CREATE INDEX IF NOT EXISTS "PaymentToken_universityId_idx"
  ON "PaymentToken"("universityId");
