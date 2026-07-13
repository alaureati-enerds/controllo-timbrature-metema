-- CreateTable
CREATE TABLE "timbratura_corretta" (
    "id" TEXT NOT NULL,
    "dipendente" TEXT NOT NULL,
    "giorno" TEXT NOT NULL,
    "entrata1" TEXT,
    "uscita1" TEXT,
    "entrata2" TEXT,
    "uscita2" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "timbratura_corretta_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "timbratura_corretta_dipendente_giorno_key" ON "timbratura_corretta"("dipendente", "giorno");
