ALTER TABLE "User"
ADD COLUMN "username" TEXT,
ALTER COLUMN "phone" DROP NOT NULL;

CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
