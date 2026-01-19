/*
  Warnings:

  - You are about to drop the column `role` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "User" DROP COLUMN "role",
ADD COLUMN     "password" TEXT,
ALTER COLUMN "name" DROP NOT NULL,
ALTER COLUMN "oauthProvider" DROP NOT NULL;

-- DropEnum
DROP TYPE "UserRole";
