-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Lang" AS ENUM ('ar', 'en');

-- CreateEnum
CREATE TYPE "ItemType" AS ENUM ('book', 'paper', 'study', 'article', 'other');

-- CreateEnum
CREATE TYPE "DocOrigin" AS ENUM ('upload', 'catalog');

-- CreateEnum
CREATE TYPE "DocFormat" AS ENUM ('pdf', 'html');

-- CreateEnum
CREATE TYPE "TextStatus" AS ENUM ('pending', 'ok', 'scanned', 'garbled');

-- CreateEnum
CREATE TYPE "AnnotationKind" AS ENUM ('highlight', 'note', 'bookmark');

-- CreateEnum
CREATE TYPE "EnglishLevel" AS ENUM ('beginner', 'intermediate', 'advanced');

-- CreateEnum
CREATE TYPE "ExplainLang" AS ENUM ('ar', 'en', 'both');

-- CreateTable
CREATE TABLE "Profile" (
    "id" UUID NOT NULL,
    "displayName" TEXT,
    "preferences" JSONB NOT NULL DEFAULT '{}',
    "englishLevel" "EnglishLevel",
    "assistEnabled" BOOLEAN NOT NULL DEFAULT true,
    "assistDensity" INTEGER NOT NULL DEFAULT 50,
    "explainLang" "ExplainLang" NOT NULL DEFAULT 'both',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CatalogItem" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "type" "ItemType" NOT NULL,
    "title" TEXT NOT NULL,
    "authors" TEXT[],
    "language" "Lang" NOT NULL,
    "year" INTEGER,
    "abstract" TEXT,
    "subjects" TEXT[],
    "coverUrl" TEXT,
    "pdfUrl" TEXT,
    "htmlUrl" TEXT,
    "license" TEXT NOT NULL,
    "licenseUrl" TEXT,
    "attribution" TEXT,
    "sourceUrl" TEXT NOT NULL,
    "linkOutOnly" BOOLEAN NOT NULL DEFAULT false,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CatalogItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncState" (
    "source" TEXT NOT NULL,
    "cursor" TEXT,
    "lastRunAt" TIMESTAMP(3),
    "lastError" TEXT,

    CONSTRAINT "SyncState_pkey" PRIMARY KEY ("source")
);

-- CreateTable
CREATE TABLE "Content" (
    "id" TEXT NOT NULL,
    "format" "DocFormat" NOT NULL,
    "storageKey" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "pageCount" INTEGER,
    "language" "Lang",
    "direction" TEXT,
    "textStatus" "TextStatus" NOT NULL DEFAULT 'pending',
    "toc" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Content_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentPage" (
    "contentId" TEXT NOT NULL,
    "pageIndex" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "blocks" JSONB NOT NULL,

    CONSTRAINT "ContentPage_pkey" PRIMARY KEY ("contentId","pageIndex")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "origin" "DocOrigin" NOT NULL,
    "type" "ItemType" NOT NULL DEFAULT 'other',
    "title" TEXT NOT NULL,
    "authors" TEXT[],
    "language" "Lang",
    "coverKey" TEXT,
    "assistEnabled" BOOLEAN NOT NULL DEFAULT true,
    "contentId" TEXT,
    "catalogItemId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastOpenedAt" TIMESTAMP(3),

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReadingProgress" (
    "documentId" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "pageIndex" INTEGER NOT NULL,
    "blockIndex" INTEGER,
    "charOffset" INTEGER,
    "percent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReadingProgress_pkey" PRIMARY KEY ("documentId")
);

-- CreateTable
CREATE TABLE "Annotation" (
    "id" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "documentId" TEXT NOT NULL,
    "kind" "AnnotationKind" NOT NULL,
    "color" TEXT,
    "pageIndex" INTEGER NOT NULL,
    "start" INTEGER,
    "end" INTEGER,
    "quote" TEXT,
    "prefix" TEXT,
    "suffix" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Annotation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssistPage" (
    "contentId" TEXT NOT NULL,
    "pageIndex" INTEGER NOT NULL,
    "promptVersion" INTEGER NOT NULL,
    "model" TEXT NOT NULL,
    "terms" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssistPage_pkey" PRIMARY KEY ("contentId","pageIndex","promptVersion")
);

-- CreateTable
CREATE TABLE "Entity" (
    "id" TEXT NOT NULL,
    "labelEn" TEXT,
    "labelAr" TEXT,
    "descriptionEn" TEXT,
    "descriptionAr" TEXT,
    "born" TEXT,
    "died" TEXT,
    "imageUrl" TEXT,
    "wikiUrlEn" TEXT,
    "wikiUrlAr" TEXT,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Entity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EntityLookup" (
    "query" TEXT NOT NULL,
    "lang" "Lang" NOT NULL,
    "entityId" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EntityLookup_pkey" PRIMARY KEY ("query","lang")
);

-- CreateTable
CREATE TABLE "ExplainCache" (
    "key" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "response" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExplainCache_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "KnownWord" (
    "userId" UUID NOT NULL,
    "lang" "Lang" NOT NULL,
    "lemma" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KnownWord_pkey" PRIMARY KEY ("userId","lang","lemma")
);

-- CreateTable
CREATE TABLE "SavedWord" (
    "id" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "lang" "Lang" NOT NULL,
    "lemma" TEXT NOT NULL,
    "surface" TEXT NOT NULL,
    "translation" TEXT,
    "meaning" TEXT,
    "sentence" TEXT NOT NULL,
    "documentId" TEXT,
    "pageIndex" INTEGER,
    "start" INTEGER,
    "end" INTEGER,
    "dueAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "intervalDays" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ease" DOUBLE PRECISION NOT NULL DEFAULT 2.5,
    "reps" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedWord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiUsage" (
    "day" DATE NOT NULL,
    "model" TEXT NOT NULL,
    "requests" INTEGER NOT NULL DEFAULT 0,
    "pausedUntil" TIMESTAMP(3),

    CONSTRAINT "AiUsage_pkey" PRIMARY KEY ("day","model")
);

-- CreateTable
CREATE TABLE "AiUserUsage" (
    "userId" UUID NOT NULL,
    "day" DATE NOT NULL,
    "requests" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "AiUserUsage_pkey" PRIMARY KEY ("userId","day")
);

-- CreateIndex
CREATE INDEX "CatalogItem_language_type_idx" ON "CatalogItem"("language", "type");

-- CreateIndex
CREATE UNIQUE INDEX "CatalogItem_source_sourceId_key" ON "CatalogItem"("source", "sourceId");

-- CreateIndex
CREATE INDEX "Document_userId_lastOpenedAt_idx" ON "Document"("userId", "lastOpenedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Document_userId_catalogItemId_key" ON "Document"("userId", "catalogItemId");

-- CreateIndex
CREATE INDEX "Annotation_documentId_pageIndex_idx" ON "Annotation"("documentId", "pageIndex");

-- CreateIndex
CREATE INDEX "SavedWord_userId_dueAt_idx" ON "SavedWord"("userId", "dueAt");

-- CreateIndex
CREATE UNIQUE INDEX "SavedWord_userId_lang_lemma_key" ON "SavedWord"("userId", "lang", "lemma");

-- AddForeignKey
ALTER TABLE "ContentPage" ADD CONSTRAINT "ContentPage_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "Content"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "Content"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_catalogItemId_fkey" FOREIGN KEY ("catalogItemId") REFERENCES "CatalogItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReadingProgress" ADD CONSTRAINT "ReadingProgress_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReadingProgress" ADD CONSTRAINT "ReadingProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Annotation" ADD CONSTRAINT "Annotation_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Annotation" ADD CONSTRAINT "Annotation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssistPage" ADD CONSTRAINT "AssistPage_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "Content"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntityLookup" ADD CONSTRAINT "EntityLookup_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnownWord" ADD CONSTRAINT "KnownWord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedWord" ADD CONSTRAINT "SavedWord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedWord" ADD CONSTRAINT "SavedWord_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiUserUsage" ADD CONSTRAINT "AiUserUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Lock every table from Supabase's public Data API (anon/authenticated roles).
-- RLS is on with no policies; the app connects as the database owner, which bypasses RLS.
ALTER TABLE "Profile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CatalogItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SyncState" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Content" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ContentPage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Document" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ReadingProgress" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Annotation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AssistPage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Entity" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EntityLookup" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ExplainCache" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "KnownWord" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SavedWord" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AiUsage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AiUserUsage" ENABLE ROW LEVEL SECURITY;
