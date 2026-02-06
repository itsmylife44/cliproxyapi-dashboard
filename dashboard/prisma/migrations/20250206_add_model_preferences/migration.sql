-- CreateTable
CREATE TABLE "model_preferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "excludedModels" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "model_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "model_preferences_userId_key" ON "model_preferences"("userId");

-- AddForeignKey
ALTER TABLE "model_preferences" ADD CONSTRAINT "model_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
