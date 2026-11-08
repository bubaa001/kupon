ALTER TABLE "User" ADD COLUMN "managedVendorId" TEXT;

CREATE INDEX "User_managedVendorId_role_idx" ON "User"("managedVendorId", "role");

ALTER TABLE "User"
ADD CONSTRAINT "User_managedVendorId_fkey"
FOREIGN KEY ("managedVendorId") REFERENCES "Vendor"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
