/*
  Warnings:

  - Added the required column `map` to the `ContentPage` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Annotation" ADD COLUMN     "endPage" INTEGER;

-- AlterTable
ALTER TABLE "Content" ADD COLUMN     "extractLock" TIMESTAMP(3),
ADD COLUMN     "pageWords" INTEGER[],
ADD COLUMN     "textVersion" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "ContentPage" ADD COLUMN     "map" JSONB NOT NULL,
ADD COLUMN     "words" INTEGER NOT NULL DEFAULT 0;
