CREATE TABLE "VendorApplication" (
    "id" TEXT NOT NULL,
    "ownerName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "applicantRole" TEXT NOT NULL DEFAULT 'OWNER',
    "authorizationDocumentUrl" TEXT,
    "businessName" TEXT NOT NULL,
    "universityName" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "businessRegistrationNumber" TEXT NOT NULL,
    "physicalAddress" TEXT NOT NULL,
    "registrationDocumentUrl" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewNote" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "universityId" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VendorApplication_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "VendorApplication_userId_key" ON "VendorApplication"("userId");
CREATE INDEX "VendorApplication_status_createdAt_idx" ON "VendorApplication"("status", "createdAt");
CREATE INDEX "VendorApplication_email_status_idx" ON "VendorApplication"("email", "status");

ALTER TABLE "VendorApplication"
ADD CONSTRAINT "VendorApplication_universityId_fkey"
FOREIGN KEY ("universityId") REFERENCES "University"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "VendorApplication"
ADD CONSTRAINT "VendorApplication_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
