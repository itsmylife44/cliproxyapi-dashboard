-- CreateTable
CREATE TABLE "config_templates" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "shareCode" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'My Config',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "config_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "config_subscriptions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "frozenConfig" JSONB,
    "previousConfig" JSONB,
    "subscribedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSyncedAt" TIMESTAMP(3),

    CONSTRAINT "config_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "config_templates_userId_key" ON "config_templates"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "config_templates_shareCode_key" ON "config_templates"("shareCode");

-- CreateIndex
CREATE INDEX "config_templates_shareCode_idx" ON "config_templates"("shareCode");

-- CreateIndex
CREATE UNIQUE INDEX "config_subscriptions_userId_key" ON "config_subscriptions"("userId");

-- CreateIndex
CREATE INDEX "config_subscriptions_templateId_idx" ON "config_subscriptions"("templateId");

-- AddForeignKey
ALTER TABLE "config_templates" ADD CONSTRAINT "config_templates_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "config_subscriptions" ADD CONSTRAINT "config_subscriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "config_subscriptions" ADD CONSTRAINT "config_subscriptions_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "config_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
