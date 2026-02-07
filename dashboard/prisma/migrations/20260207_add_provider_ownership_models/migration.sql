-- CreateTable
CREATE TABLE "provider_key_ownerships" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "keyIdentifier" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "provider_key_ownerships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_oauth_ownerships" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "accountEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "provider_oauth_ownerships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_settings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "provider_key_ownerships_keyHash_key" ON "provider_key_ownerships"("keyHash");

-- CreateIndex
CREATE INDEX "provider_key_ownerships_userId_idx" ON "provider_key_ownerships"("userId");

-- CreateIndex
CREATE INDEX "provider_key_ownerships_provider_idx" ON "provider_key_ownerships"("provider");

-- CreateIndex
CREATE UNIQUE INDEX "provider_oauth_ownerships_accountName_key" ON "provider_oauth_ownerships"("accountName");

-- CreateIndex
CREATE INDEX "provider_oauth_ownerships_userId_idx" ON "provider_oauth_ownerships"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "system_settings_key_key" ON "system_settings"("key");

-- AddForeignKey
ALTER TABLE "provider_key_ownerships" ADD CONSTRAINT "provider_key_ownerships_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_oauth_ownerships" ADD CONSTRAINT "provider_oauth_ownerships_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
