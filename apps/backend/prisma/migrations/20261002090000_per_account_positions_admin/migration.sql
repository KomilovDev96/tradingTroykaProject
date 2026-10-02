-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'SUPERADMIN');

-- CreateEnum
CREATE TYPE "ResetRequestStatus" AS ENUM ('OPEN', 'RESOLVED');

-- DropIndex
DROP INDEX "Trade_signalId_key";

-- AlterTable
ALTER TABLE "Account" ADD COLUMN     "analysisPaused" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastLoginAt" TIMESTAMP(3),
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "role" "Role" NOT NULL DEFAULT 'USER';

-- AlterTable
ALTER TABLE "Trade" ADD COLUMN     "accountId" TEXT;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "analysisPaused";

-- CreateTable
CREATE TABLE "PasswordResetRequest" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "accountId" TEXT,
    "status" "ResetRequestStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "PasswordResetRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PasswordResetRequest_status_createdAt_idx" ON "PasswordResetRequest"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Account_phone_key" ON "Account"("phone");

-- CreateIndex
CREATE INDEX "Trade_accountId_status_idx" ON "Trade"("accountId", "status");

-- CreateIndex
CREATE INDEX "Trade_signalId_status_idx" ON "Trade"("signalId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Trade_signalId_accountId_key" ON "Trade"("signalId", "accountId");

-- AddForeignKey
ALTER TABLE "Trade" ADD CONSTRAINT "Trade_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetRequest" ADD CONSTRAINT "PasswordResetRequest_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

