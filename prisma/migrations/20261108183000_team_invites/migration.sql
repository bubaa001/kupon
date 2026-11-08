CREATE TABLE "TeamInvite" (
  "id" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "universityId" TEXT NOT NULL,
  "vendorId" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "acceptedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "TeamInvite_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TeamInvite_tokenHash_key" ON "TeamInvite"("tokenHash");
CREATE INDEX "TeamInvite_vendorId_acceptedAt_expiresAt_idx"
  ON "TeamInvite"("vendorId", "acceptedAt", "expiresAt");
CREATE INDEX "TeamInvite_email_idx" ON "TeamInvite"("email");

ALTER TABLE "TeamInvite"
  ADD CONSTRAINT "TeamInvite_universityId_fkey"
  FOREIGN KEY ("universityId") REFERENCES "University"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeamInvite"
  ADD CONSTRAINT "TeamInvite_vendorId_fkey"
  FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeamInvite"
  ADD CONSTRAINT "TeamInvite_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
