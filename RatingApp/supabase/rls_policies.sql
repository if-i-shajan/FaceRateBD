-- FaceRate BD — run this in Supabase: Dashboard → SQL → New query → Run
-- Fixes "Submit Rating" doing nothing when RLS blocks anon access.

-- If upsert fails in the app, add a unique pair (uncomment; skip if you already have UNIQUE on these columns):
-- CREATE UNIQUE INDEX IF NOT EXISTS ratings_photo_id_user_id_uidx ON public.ratings (photo_id, user_id);

-- ─── ratings ───
ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ratings_anon_select" ON public.ratings;
CREATE POLICY "ratings_anon_select" ON public.ratings FOR SELECT USING (true);

DROP POLICY IF EXISTS "ratings_anon_insert" ON public.ratings;
CREATE POLICY "ratings_anon_insert" ON public.ratings FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "ratings_anon_update" ON public.ratings;
CREATE POLICY "ratings_anon_update" ON public.ratings FOR UPDATE USING (true) WITH CHECK (true);

-- ─── user_progress ───
ALTER TABLE public.user_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_progress_anon_select" ON public.user_progress;
CREATE POLICY "user_progress_anon_select" ON public.user_progress FOR SELECT USING (true);

DROP POLICY IF EXISTS "user_progress_anon_insert" ON public.user_progress;
CREATE POLICY "user_progress_anon_insert" ON public.user_progress FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "user_progress_anon_update" ON public.user_progress;
CREATE POLICY "user_progress_anon_update" ON public.user_progress FOR UPDATE USING (true) WITH CHECK (true);

-- ─── users (login / signup) ───
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_anon_select" ON public.users;
CREATE POLICY "users_anon_select" ON public.users FOR SELECT USING (true);

DROP POLICY IF EXISTS "users_anon_insert" ON public.users;
CREATE POLICY "users_anon_insert" ON public.users FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "users_anon_update" ON public.users;
CREATE POLICY "users_anon_update" ON public.users FOR UPDATE USING (true) WITH CHECK (true);

-- ─── photos (read for raters; admin uses same anon key in this app) ───
ALTER TABLE public.photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "photos_anon_select" ON public.photos;
CREATE POLICY "photos_anon_select" ON public.photos FOR SELECT USING (true);

DROP POLICY IF EXISTS "photos_anon_insert" ON public.photos;
CREATE POLICY "photos_anon_insert" ON public.photos FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "photos_anon_delete" ON public.photos;
CREATE POLICY "photos_anon_delete" ON public.photos FOR DELETE USING (true);
