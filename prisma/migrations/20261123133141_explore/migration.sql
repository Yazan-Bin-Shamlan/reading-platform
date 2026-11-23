-- AlterTable
ALTER TABLE "CatalogItem" ADD COLUMN     "altTitle" TEXT,
ADD COLUMN     "contentId" TEXT;

-- CreateTable
CREATE TABLE "SourceCache" (
    "key" TEXT NOT NULL,
    "body" JSONB NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SourceCache_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "SourceCache_expiresAt_idx" ON "SourceCache"("expiresAt");

-- CreateIndex
CREATE INDEX "CatalogItem_source_syncedAt_idx" ON "CatalogItem"("source", "syncedAt");

-- AddForeignKey
ALTER TABLE "CatalogItem" ADD CONSTRAINT "CatalogItem_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "Content"("id") ON DELETE SET NULL ON UPDATE CASCADE;
