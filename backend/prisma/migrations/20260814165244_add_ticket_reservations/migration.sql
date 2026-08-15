-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'CONFIRMED', 'CANCELLED');

-- CreateTable
CREATE TABLE "ticket_reservations" (
    "id" UUID NOT NULL,
    "ticketTypeId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "status" "ReservationStatus" NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ticket_reservations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ticket_reservations_ticketTypeId_idx" ON "ticket_reservations"("ticketTypeId");

-- CreateIndex
CREATE INDEX "ticket_reservations_userId_idx" ON "ticket_reservations"("userId");

-- CreateIndex
CREATE INDEX "ticket_reservations_ticketTypeId_status_idx" ON "ticket_reservations"("ticketTypeId", "status");

-- CreateIndex
CREATE INDEX "ticket_reservations_expiresAt_idx" ON "ticket_reservations"("expiresAt");

-- AddForeignKey
ALTER TABLE "ticket_reservations" ADD CONSTRAINT "ticket_reservations_ticketTypeId_fkey" FOREIGN KEY ("ticketTypeId") REFERENCES "ticket_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_reservations" ADD CONSTRAINT "ticket_reservations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
