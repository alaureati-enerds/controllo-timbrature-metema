-- AlterTable
ALTER TABLE "timbratura_corretta" ADD COLUMN     "giustificativo" TEXT;

-- CreateTable
CREATE TABLE "giustificativo" (
    "id" TEXT NOT NULL,
    "codice" TEXT NOT NULL,
    "descrizione" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "giustificativo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "giustificativo_codice_key" ON "giustificativo"("codice");
