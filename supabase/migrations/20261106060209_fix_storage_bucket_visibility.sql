-- Ensure all storage buckets are private (not public)
-- Applied to Opeke to confirm private bucket settings
update storage.buckets set public = false
where public = true;
