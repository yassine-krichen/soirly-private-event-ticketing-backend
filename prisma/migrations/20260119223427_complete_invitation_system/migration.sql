/*
  Warnings:

  - You are about to drop the column `inviteeCount` on the `Event` table. All the data in the column will be lost.
  - You are about to drop the column `konnectPaymentUrl` on the `Payment` table. All the data in the column will be lost.
  - You are about to drop the column `konnectReference` on the `Payment` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[inviteToken]` on the table `Event` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[providerReference]` on the table `Payment` will be added. If there are existing duplicate values, this will fail.
  - The required column `inviteToken` was added to the `Event` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.
  - Added the required column `invitationId` to the `Payment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `providerReference` to the `Payment` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'CONFIRMED', 'DECLINED');

-- DropIndex
DROP INDEX "Payment_konnectReference_key";

-- AlterTable
ALTER TABLE "Event" DROP COLUMN "inviteeCount",
ADD COLUMN     "inviteLinkActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "inviteToken" TEXT NOT NULL,
ADD COLUMN     "maxAttendees" INTEGER,
ADD COLUMN     "sponsorId" TEXT,
ALTER COLUMN "description" DROP NOT NULL,
ALTER COLUMN "location" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Payment" DROP COLUMN "konnectPaymentUrl",
DROP COLUMN "konnectReference",
ADD COLUMN     "invitationId" TEXT NOT NULL,
ADD COLUMN     "provider" TEXT NOT NULL DEFAULT 'konnect',
ADD COLUMN     "providerPaymentUrl" TEXT,
ADD COLUMN     "providerReference" TEXT NOT NULL,
ADD COLUMN     "receiptUrl" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "oauthId" TEXT,
ADD COLUMN     "role" "Role" NOT NULL DEFAULT 'USER';

-- CreateTable
CREATE TABLE "EventInvitation" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "confirmedAt" TIMESTAMP(3),
    "declinedAt" TIMESTAMP(3),

    CONSTRAINT "EventInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ticket" (
    "id" TEXT NOT NULL,
    "ticketCode" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checkedInAt" TIMESTAMP(3),

    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentMethod" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerToken" TEXT NOT NULL,
    "cardBrand" TEXT,
    "cardLast4" TEXT,
    "expMonth" INTEGER,
    "expYear" INTEGER,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentMethod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sponsor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "logoUrl" TEXT,
    "contactEmail" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "paidUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sponsor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EventInvitation_eventId_status_idx" ON "EventInvitation"("eventId", "status");

-- CreateIndex
CREATE INDEX "EventInvitation_userId_idx" ON "EventInvitation"("userId");

-- CreateIndex
CREATE INDEX "EventInvitation_status_idx" ON "EventInvitation"("status");

-- CreateIndex
CREATE UNIQUE INDEX "EventInvitation_eventId_userId_key" ON "EventInvitation"("eventId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_ticketCode_key" ON "Ticket"("ticketCode");

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_paymentId_key" ON "Ticket"("paymentId");

-- CreateIndex
CREATE INDEX "Ticket_eventId_idx" ON "Ticket"("eventId");

-- CreateIndex
CREATE INDEX "Ticket_userId_idx" ON "Ticket"("userId");

-- CreateIndex
CREATE INDEX "Ticket_ticketCode_idx" ON "Ticket"("ticketCode");

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_eventId_userId_key" ON "Ticket"("eventId", "userId");

-- CreateIndex
CREATE INDEX "PaymentMethod_userId_idx" ON "PaymentMethod"("userId");

-- CreateIndex
CREATE INDEX "PaymentMethod_isDefault_idx" ON "PaymentMethod"("isDefault");

-- CreateIndex
CREATE INDEX "Sponsor_active_idx" ON "Sponsor"("active");

-- CreateIndex
CREATE UNIQUE INDEX "Event_inviteToken_key" ON "Event"("inviteToken");

-- CreateIndex
CREATE INDEX "Event_dateTime_idx" ON "Event"("dateTime");

-- CreateIndex
CREATE INDEX "Event_inviteToken_idx" ON "Event"("inviteToken");

-- CreateIndex
CREATE INDEX "Event_sponsorId_idx" ON "Event"("sponsorId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_providerReference_key" ON "Payment"("providerReference");

-- CreateIndex
CREATE INDEX "Payment_invitationId_idx" ON "Payment"("invitationId");

-- CreateIndex
CREATE INDEX "Payment_status_idx" ON "Payment"("status");

-- CreateIndex
CREATE INDEX "Payment_provider_idx" ON "Payment"("provider");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_isActive_idx" ON "User"("isActive");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_sponsorId_fkey" FOREIGN KEY ("sponsorId") REFERENCES "Sponsor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventInvitation" ADD CONSTRAINT "EventInvitation_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventInvitation" ADD CONSTRAINT "EventInvitation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_invitationId_fkey" FOREIGN KEY ("invitationId") REFERENCES "EventInvitation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentMethod" ADD CONSTRAINT "PaymentMethod_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
