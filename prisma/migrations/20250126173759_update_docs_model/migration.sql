/*
  Warnings:

  - You are about to drop the `Embed` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterTable
ALTER TABLE "docs" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- DropTable
DROP TABLE "Embed";