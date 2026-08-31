-- Allow admin routes to read every row when the transaction-local
-- setting app.bypass_rls is 'on' (see Backend/src/lib/rls.ts withAdminRls).
-- Per-user isolation for normal traffic is unchanged.

ALTER POLICY "books_user_isolation" ON "books"
  USING (
    current_setting('app.bypass_rls', true) = 'on'
    OR "userId" = NULLIF(current_setting('app.current_user_id', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.bypass_rls', true) = 'on'
    OR "userId" = NULLIF(current_setting('app.current_user_id', true), '')::uuid
  );

ALTER POLICY "chapters_user_isolation" ON "chapters"
  USING (
    current_setting('app.bypass_rls', true) = 'on'
    OR EXISTS (
      SELECT 1
      FROM "books"
      WHERE "books"."id" = "chapters"."bookId"
        AND "books"."userId" = NULLIF(current_setting('app.current_user_id', true), '')::uuid
    )
  )
  WITH CHECK (
    current_setting('app.bypass_rls', true) = 'on'
    OR EXISTS (
      SELECT 1
      FROM "books"
      WHERE "books"."id" = "chapters"."bookId"
        AND "books"."userId" = NULLIF(current_setting('app.current_user_id', true), '')::uuid
    )
  );

ALTER POLICY "chapter_versions_user_isolation" ON "chapter_versions"
  USING (
    current_setting('app.bypass_rls', true) = 'on'
    OR EXISTS (
      SELECT 1
      FROM "chapters"
      INNER JOIN "books" ON "books"."id" = "chapters"."bookId"
      WHERE "chapters"."id" = "chapter_versions"."chapterId"
        AND "books"."userId" = NULLIF(current_setting('app.current_user_id', true), '')::uuid
    )
  )
  WITH CHECK (
    current_setting('app.bypass_rls', true) = 'on'
    OR EXISTS (
      SELECT 1
      FROM "chapters"
      INNER JOIN "books" ON "books"."id" = "chapters"."bookId"
      WHERE "chapters"."id" = "chapter_versions"."chapterId"
        AND "books"."userId" = NULLIF(current_setting('app.current_user_id', true), '')::uuid
    )
  );

ALTER POLICY "export_jobs_user_isolation" ON "export_jobs"
  USING (
    current_setting('app.bypass_rls', true) = 'on'
    OR "userId" = NULLIF(current_setting('app.current_user_id', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.bypass_rls', true) = 'on'
    OR "userId" = NULLIF(current_setting('app.current_user_id', true), '')::uuid
  );

ALTER POLICY "asset_uploads_user_isolation" ON "asset_uploads"
  USING (
    current_setting('app.bypass_rls', true) = 'on'
    OR "userId" = NULLIF(current_setting('app.current_user_id', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.bypass_rls', true) = 'on'
    OR "userId" = NULLIF(current_setting('app.current_user_id', true), '')::uuid
  );
