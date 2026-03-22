-- CreateEnum
CREATE TYPE "public"."ExportFormat" AS ENUM ('PDF', 'EPUB', 'MOBI');

-- CreateEnum
CREATE TYPE "public"."ExportStatus" AS ENUM ('QUEUED', 'PROCESSING', 'DONE', 'FAILED');

-- CreateTable
CREATE TABLE "public"."users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."books" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "coverUrl" TEXT,
    "genre" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "userId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "books_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."chapters" (
    "id" UUID NOT NULL,
    "bookId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chapters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."chapter_versions" (
    "id" UUID NOT NULL,
    "chapterId" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "savedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chapter_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."export_jobs" (
    "id" UUID NOT NULL,
    "bookId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "format" "public"."ExportFormat" NOT NULL,
    "status" "public"."ExportStatus" NOT NULL,
    "fileUrl" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "export_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."asset_uploads" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "bookId" UUID NOT NULL,
    "s3Key" TEXT NOT NULL,
    "cdnUrl" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asset_uploads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "public"."users"("email");

-- CreateIndex
CREATE INDEX "books_userId_idx" ON "public"."books"("userId");

-- CreateIndex
CREATE INDEX "chapters_bookId_idx" ON "public"."chapters"("bookId");

-- CreateIndex
CREATE UNIQUE INDEX "chapters_bookId_order_key" ON "public"."chapters"("bookId", "order");

-- CreateIndex
CREATE INDEX "chapter_versions_chapterId_savedAt_idx" ON "public"."chapter_versions"("chapterId", "savedAt" DESC);

-- CreateIndex
CREATE INDEX "export_jobs_bookId_idx" ON "public"."export_jobs"("bookId");

-- CreateIndex
CREATE INDEX "export_jobs_userId_idx" ON "public"."export_jobs"("userId");

-- CreateIndex
CREATE INDEX "asset_uploads_userId_idx" ON "public"."asset_uploads"("userId");

-- CreateIndex
CREATE INDEX "asset_uploads_bookId_idx" ON "public"."asset_uploads"("bookId");

-- AddForeignKey
ALTER TABLE "public"."books" ADD CONSTRAINT "books_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."chapters" ADD CONSTRAINT "chapters_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "public"."books"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."chapter_versions" ADD CONSTRAINT "chapter_versions_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "public"."chapters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."export_jobs" ADD CONSTRAINT "export_jobs_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "public"."books"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."export_jobs" ADD CONSTRAINT "export_jobs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."asset_uploads" ADD CONSTRAINT "asset_uploads_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."asset_uploads" ADD CONSTRAINT "asset_uploads_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "public"."books"("id") ON DELETE CASCADE ON UPDATE CASCADE;
