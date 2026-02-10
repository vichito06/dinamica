/*
  Warnings:

  - The values [PENDING,FAILED] on the enum `SaleStatus` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `payphoneClientTxId` on the `Sale` table. All the data in the column will be lost.
  - You are about to drop the column `personalData` on the `Sale` table. All the data in the column will be lost.
  - You are about to drop the column `reservedBySaleId` on the `Ticket` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[clientTransactionId]` on the table `Sale` will be added. If there are existing duplicate values, this will fail.
  - The required column `clientTransactionId` was added to the `Sale` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.
  - Added the required column `customerId` to the `Sale` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('PAYPHONE');

-- AlterEnum
BEGIN;
CREATE TYPE "SaleStatus_new" AS ENUM ('PENDING_PAYMENT', 'PAID', 'CANCELED', 'EXPIRED');
ALTER TABLE "public"."Sale" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Sale" ALTER COLUMN "status" TYPE "SaleStatus_new" USING ("status"::text::"SaleStatus_new");
ALTER TYPE "SaleStatus" RENAME TO "SaleStatus_old";
ALTER TYPE "SaleStatus_new" RENAME TO "SaleStatus";
DROP TYPE "public"."SaleStatus_old";
ALTER TABLE "Sale" ALTER COLUMN "status" SET DEFAULT 'PENDING_PAYMENT';
COMMIT;

-- DropForeignKey
ALTER TABLE "Ticket" DROP CONSTRAINT "Ticket_reservedBySaleId_fkey";

-- DropIndex
DROP INDEX "Sale_payphoneClientTxId_key";

-- AlterTable
ALTER TABLE "Sale" DROP COLUMN "payphoneClientTxId",
DROP COLUMN "personalData",
ADD COLUMN     "clientTransactionId" TEXT NOT NULL,
ADD COLUMN     "confirmedAt" TIMESTAMP(3),
ADD COLUMN     "customerId" TEXT NOT NULL,
ADD COLUMN     "provider" "PaymentProvider" NOT NULL DEFAULT 'PAYPHONE',
ALTER COLUMN "status" SET DEFAULT 'PENDING_PAYMENT';

-- AlterTable
ALTER TABLE "Ticket" DROP COLUMN "reservedBySaleId";

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "idNumber" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Customer_idNumber_key" ON "Customer"("idNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Sale_clientTransactionId_key" ON "Sale"("clientTransactionId");

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
