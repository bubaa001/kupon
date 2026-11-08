ALTER TABLE "VendorApplication"
ADD COLUMN "nidaNumber" TEXT NOT NULL DEFAULT '',
ADD COLUMN "institutionPhone" TEXT NOT NULL DEFAULT '',
ADD COLUMN "tinDocumentKey" TEXT;

ALTER TABLE "VendorApplication"
DROP COLUMN "applicantRole",
DROP COLUMN "authorizationDocumentUrl",
DROP COLUMN "city",
DROP COLUMN "description",
DROP COLUMN "businessRegistrationNumber",
DROP COLUMN "physicalAddress",
DROP COLUMN "registrationDocumentUrl";
