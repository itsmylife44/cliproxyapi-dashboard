CREATE TABLE "provider_groups" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "provider_groups_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "custom_providers" ADD COLUMN "groupId" TEXT,
ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX "provider_groups_userId_name_key" ON "provider_groups"("userId", "name");

CREATE INDEX "provider_groups_userId_idx" ON "provider_groups"("userId");

CREATE INDEX "custom_providers_groupId_idx" ON "custom_providers"("groupId");

ALTER TABLE "custom_providers" ADD CONSTRAINT "custom_providers_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "provider_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "provider_groups" ADD CONSTRAINT "provider_groups_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
