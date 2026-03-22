ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "users" FORCE ROW LEVEL SECURITY;

CREATE POLICY "users_self_access" ON "users"
  USING ("id" = NULLIF(current_setting('app.current_user_id', true), '')::uuid)
  WITH CHECK ("id" = NULLIF(current_setting('app.current_user_id', true), '')::uuid);

ALTER TABLE "books" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "books" FORCE ROW LEVEL SECURITY;

CREATE POLICY "books_user_isolation" ON "books"
  USING ("userId" = NULLIF(current_setting('app.current_user_id', true), '')::uuid)
  WITH CHECK ("userId" = NULLIF(current_setting('app.current_user_id', true), '')::uuid);

ALTER TABLE "chapters" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "chapters" FORCE ROW LEVEL SECURITY;

CREATE POLICY "chapters_user_isolation" ON "chapters"
  USING (
    EXISTS (
      SELECT 1
      FROM "books"
      WHERE "books"."id" = "chapters"."bookId"
        AND "books"."userId" = NULLIF(current_setting('app.current_user_id', true), '')::uuid
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM "books"
      WHERE "books"."id" = "chapters"."bookId"
        AND "books"."userId" = NULLIF(current_setting('app.current_user_id', true), '')::uuid
    )
  );

ALTER TABLE "chapter_versions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "chapter_versions" FORCE ROW LEVEL SECURITY;

CREATE POLICY "chapter_versions_user_isolation" ON "chapter_versions"
  USING (
    EXISTS (
      SELECT 1
      FROM "chapters"
      INNER JOIN "books" ON "books"."id" = "chapters"."bookId"
      WHERE "chapters"."id" = "chapter_versions"."chapterId"
        AND "books"."userId" = NULLIF(current_setting('app.current_user_id', true), '')::uuid
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM "chapters"
      INNER JOIN "books" ON "books"."id" = "chapters"."bookId"
      WHERE "chapters"."id" = "chapter_versions"."chapterId"
        AND "books"."userId" = NULLIF(current_setting('app.current_user_id', true), '')::uuid
    )
  );

ALTER TABLE "export_jobs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "export_jobs" FORCE ROW LEVEL SECURITY;

CREATE POLICY "export_jobs_user_isolation" ON "export_jobs"
  USING ("userId" = NULLIF(current_setting('app.current_user_id', true), '')::uuid)
  WITH CHECK ("userId" = NULLIF(current_setting('app.current_user_id', true), '')::uuid);

ALTER TABLE "asset_uploads" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "asset_uploads" FORCE ROW LEVEL SECURITY;

CREATE POLICY "asset_uploads_user_isolation" ON "asset_uploads"
  USING ("userId" = NULLIF(current_setting('app.current_user_id', true), '')::uuid)
  WITH CHECK ("userId" = NULLIF(current_setting('app.current_user_id', true), '')::uuid);
