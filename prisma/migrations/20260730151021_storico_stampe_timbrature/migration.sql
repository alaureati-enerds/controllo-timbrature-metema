-- CreateTable
CREATE TABLE "stampa_generata" (
    "id" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "originalName" TEXT NOT NULL,
    "dipendente" TEXT,
    "dipendenteLabel" TEXT,
    "cumulativo" BOOLEAN NOT NULL DEFAULT false,
    "mese" INTEGER NOT NULL,
    "anno" INTEGER NOT NULL,
    "templateId" TEXT NOT NULL,
    "actorId" TEXT,
    "actorEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stampa_generata_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "stampa_generata_storageKey_key" ON "stampa_generata"("storageKey");

-- CreateIndex
CREATE INDEX "stampa_generata_mese_anno_idx" ON "stampa_generata"("mese", "anno");

-- CreateIndex
CREATE INDEX "stampa_generata_dipendente_idx" ON "stampa_generata"("dipendente");

-- CreateIndex
CREATE INDEX "stampa_generata_createdAt_idx" ON "stampa_generata"("createdAt");
