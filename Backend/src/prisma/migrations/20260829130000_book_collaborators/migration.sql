-- Book sharing: collaborators table + row-level security that grants
-- collaborators access to a book's chapters while keeping book metadata
-- (title, cover, deletion) owner-only.
--
-- NOTE: the helper functions below are SECURITY DEFINER and must be created
-- by a role that bypasses RLS (the migration/superuser role). They exist so
-- policies on `books` and `book_collaborators` can reference each other
-- without Postgres detecting policy recursion.

-- CreateEnum
CREATE TYPE "public"."CollaboratorRole" AS ENUM ('EDITOR', 'VIEWER');

-- CreateTable
CREATE TABLE "public"."book_collaborators" (
    "id" UUID NOT NULL,
    "bookId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" "public"."CollaboratorRole" NOT NULL DEFAULT 'EDITOR',
    "invitedById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "book_collaborators_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "book_collaborators_bookId_userId_key" ON "public"."book_collaborators"("bookId", "userId");

-- CreateIndex
CREATE INDEX "book_collaborators_userId_idx" ON "public"."book_collaborators"("userId");

-- AddForeignKey
ALTER TABLE "public"."book_collaborators" ADD CONSTRAINT "book_collaborators_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "public"."books"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."book_collaborators" ADD CONSTRAINT "book_collaborators_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."book_collaborators" ADD CONSTRAINT "book_collaborators_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Grant the application role access to the new table (default privileges
-- normally cover this, but be explicit in case migrations run as a different role).
DO
$$
BEGIN
   IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'ebookmaker_app') THEN
      GRANT SELECT, INSERT, UPDATE, DELETE ON "public"."book_collaborators" TO ebookmaker_app;
   END IF;
END
$$;

-- Helper functions -----------------------------------------------------------

CREATE OR REPLACE FUNCTION public.app_current_user_id() RETURNS uuid
LANGUAGE sql STABLE
AS $$
  SELECT NULLIF(current_setting('app.current_user_id', true), '')::uuid
$$;

CREATE OR REPLACE FUNCTION public.app_rls_bypass() RETURNS boolean
LANGUAGE sql STABLE
AS $$
  SELECT COALESCE(current_setting('app.bypass_rls', true), '') = 'on'
$$;

-- Returns 'ADMIN' (bypass), 'OWNER', 'EDITOR', 'VIEWER' or NULL (no access).
CREATE OR REPLACE FUNCTION public.app_book_access(target_book_id uuid) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN public.app_rls_bypass() THEN 'ADMIN'
    WHEN EXISTS (
      SELECT 1 FROM public.books b
      WHERE b."id" = target_book_id AND b."userId" = public.app_current_user_id()
    ) THEN 'OWNER'
    ELSE (
      SELECT c."role"::text FROM public.book_collaborators c
      WHERE c."bookId" = target_book_id AND c."userId" = public.app_current_user_id()
      LIMIT 1
    )
  END
$$;

CREATE OR REPLACE FUNCTION public.app_can_read_book(target_book_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.app_book_access(target_book_id) IS NOT NULL
$$;

CREATE OR REPLACE FUNCTION public.app_can_write_book(target_book_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.app_book_access(target_book_id) IN ('ADMIN', 'OWNER', 'EDITOR')
$$;

CREATE OR REPLACE FUNCTION public.app_is_book_owner(target_book_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.app_book_access(target_book_id) IN ('ADMIN', 'OWNER')
$$;

CREATE OR REPLACE FUNCTION public.app_chapter_book_id(target_chapter_id uuid) RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT "bookId" FROM public.chapters WHERE "id" = target_chapter_id
$$;

-- books ----------------------------------------------------------------------

DROP POLICY IF EXISTS "books_user_isolation" ON "public"."books";

CREATE POLICY "books_read" ON "public"."books"
  FOR SELECT
  USING (public.app_can_read_book("id"));

CREATE POLICY "books_insert" ON "public"."books"
  FOR INSERT
  WITH CHECK (public.app_rls_bypass() OR "userId" = public.app_current_user_id());

CREATE POLICY "books_update" ON "public"."books"
  FOR UPDATE
  USING (public.app_rls_bypass() OR "userId" = public.app_current_user_id())
  WITH CHECK (public.app_rls_bypass() OR "userId" = public.app_current_user_id());

CREATE POLICY "books_delete" ON "public"."books"
  FOR DELETE
  USING (public.app_rls_bypass() OR "userId" = public.app_current_user_id());

-- chapters -------------------------------------------------------------------

DROP POLICY IF EXISTS "chapters_user_isolation" ON "public"."chapters";

CREATE POLICY "chapters_read" ON "public"."chapters"
  FOR SELECT
  USING (public.app_can_read_book("bookId"));

CREATE POLICY "chapters_write" ON "public"."chapters"
  FOR ALL
  USING (public.app_can_write_book("bookId"))
  WITH CHECK (public.app_can_write_book("bookId"));

-- chapter_versions -----------------------------------------------------------

DROP POLICY IF EXISTS "chapter_versions_user_isolation" ON "public"."chapter_versions";

CREATE POLICY "chapter_versions_read" ON "public"."chapter_versions"
  FOR SELECT
  USING (public.app_can_read_book(public.app_chapter_book_id("chapterId")));

CREATE POLICY "chapter_versions_write" ON "public"."chapter_versions"
  FOR ALL
  USING (public.app_can_write_book(public.app_chapter_book_id("chapterId")))
  WITH CHECK (public.app_can_write_book(public.app_chapter_book_id("chapterId")));

-- book_collaborators ---------------------------------------------------------

ALTER TABLE "public"."book_collaborators" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."book_collaborators" FORCE ROW LEVEL SECURITY;

-- Anyone with access to the book can see who else has access.
CREATE POLICY "book_collaborators_read" ON "public"."book_collaborators"
  FOR SELECT
  USING (public.app_can_read_book("bookId"));

CREATE POLICY "book_collaborators_insert" ON "public"."book_collaborators"
  FOR INSERT
  WITH CHECK (public.app_is_book_owner("bookId"));

CREATE POLICY "book_collaborators_update" ON "public"."book_collaborators"
  FOR UPDATE
  USING (public.app_is_book_owner("bookId"))
  WITH CHECK (public.app_is_book_owner("bookId"));

-- Owners can remove anyone; a collaborator can remove themself (leave).
CREATE POLICY "book_collaborators_delete" ON "public"."book_collaborators"
  FOR DELETE
  USING (public.app_is_book_owner("bookId") OR "userId" = public.app_current_user_id());
