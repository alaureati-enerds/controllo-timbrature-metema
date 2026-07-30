-- CreateTable
CREATE TABLE "dipendente_nascosto" (
    "id" TEXT NOT NULL,
    "dipendente" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dipendente_nascosto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "dipendente_nascosto_dipendente_key" ON "dipendente_nascosto"("dipendente");
