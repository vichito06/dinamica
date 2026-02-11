/*
  Warnings:

  - The values [PENDING_PAYMENT] on the enum `SaleStatus` will be removed. If these variants are still used in the database, this will fail.
  - The values [RESERVED] on the enum `TicketStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "SaleStatus_new" AS ENUM ('PENDING', 'PAID', 'CANCELED', 'EXPIRED');
ALTER TABLE "public"."Sale" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Sale"
ALTER COLUMN "status" TYPE "SaleStatus_new"
USING (
  CASE "status"::text
    WHEN 'PENDING_PAYMENT' THEN 'PENDING'
    ELSE "status"::text
  END
)::"SaleStatus_new";
ALTER TYPE "SaleStatus" RENAME TO "SaleStatus_old";
ALTER TYPE "SaleStatus_new" RENAME TO "SaleStatus";
DROP TYPE "public"."SaleStatus_old";
ALTER TABLE "Sale" ALTER COLUMN "status" SET DEFAULT 'PENDING';
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "TicketStatus_new" AS ENUM ('AVAILABLE', 'HELD', 'SOLD');
ALTER TABLE "public"."Ticket" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Ticket"
ALTER COLUMN "status" TYPE "TicketStatus_new"
USING (
  CASE "status"::text
    WHEN 'RESERVED' THEN 'HELD'
    ELSE "status"::text
  END
)::"TicketStatus_new";
ALTER TYPE "TicketStatus" RENAME TO "TicketStatus_old";
ALTER TYPE "TicketStatus_new" RENAME TO "TicketStatus";
DROP TYPE "public"."TicketStatus_old";
ALTER TABLE "Ticket" ALTER COLUMN "status" SET DEFAULT 'AVAILABLE';
COMMIT;

-- AlterTable
ALTER TABLE "Sale" ADD COLUMN     "payphoneAuthorizationCode" TEXT,
ADD COLUMN     "payphoneStatusCode" INTEGER;

-- Ensure the final default is set
ALTER TABLE "Sale" ALTER COLUMN "status" SET DEFAULT 'PENDING';
