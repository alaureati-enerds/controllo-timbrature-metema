-- CreateTable
CREATE TABLE "dipendente_rapportino" (
    "id" TEXT NOT NULL,
    "dipendente" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dipendente_rapportino_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "dipendente_rapportino_dipendente_key" ON "dipendente_rapportino"("dipendente");
