-- CreateTable
CREATE TABLE "system_setting" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "data" JSONB NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_setting_pkey" PRIMARY KEY ("id")
);
