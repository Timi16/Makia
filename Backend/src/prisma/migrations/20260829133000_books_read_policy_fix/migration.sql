-- Fix: INSERT ... RETURNING on "books" failed the books_read SELECT policy.
-- app_can_read_book() is a STABLE function, so inside the inserting statement
-- it cannot see the row being inserted and reported "no access". Check the
-- owner column inline and only use a helper for the collaborator lookup.

CREATE OR REPLACE FUNCTION public.app_is_book_collaborator(target_book_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.book_collaborators c
    WHERE c."bookId" = target_book_id AND c."userId" = public.app_current_user_id()
  )
$$;

ALTER POLICY "books_read" ON "public"."books"
  USING (
    public.app_rls_bypass()
    OR "userId" = public.app_current_user_id()
    OR public.app_is_book_collaborator("id")
  );
