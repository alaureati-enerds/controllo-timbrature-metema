-- CreateTable
CREATE TABLE "timbratura_preset" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "entrata1" TEXT,
    "uscita1" TEXT,
    "entrata2" TEXT,
    "uscita2" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "timbratura_preset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "timbratura_preset_nome_key" ON "timbratura_preset"("nome");
