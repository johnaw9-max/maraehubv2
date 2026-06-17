-- Backfill profiles rows for auth users that have no profile entry yet.
-- These are real users created directly via Supabase Auth who bypassed UserManager.
-- Derive a display name from their email prefix (e.g. "john.williams" → "John Williams").
INSERT INTO public.profiles (id, email, full_name, role, trustee_role)
SELECT
  u.id,
  u.email,
  initcap(replace(replace(split_part(u.email, '@', 1), '.', ' '), '_', ' ')),
  'trustee',
  'standard'
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- Trigger function: auto-create a community profile for any future auth signup
-- that doesn't go through UserManager (e.g. Supabase dashboard invites).
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, trustee_role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      initcap(replace(replace(split_part(NEW.email, '@', 1), '.', ' '), '_', ' '))
    ),
    'community',
    'standard'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();
