-- CreateTable
CREATE TABLE "perplexity_cookies" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cookieData" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT 'Default',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "perplexity_cookies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "perplexity_cookies_userId_idx" ON "perplexity_cookies"("userId");

-- CreateIndex
CREATE INDEX "perplexity_cookies_isActive_idx" ON "perplexity_cookies"("isActive");

-- AddForeignKey
ALTER TABLE "perplexity_cookies" ADD CONSTRAINT "perplexity_cookies_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
