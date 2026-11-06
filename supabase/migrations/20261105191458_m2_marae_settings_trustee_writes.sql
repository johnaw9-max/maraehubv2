-- Allow trustees (not just admins) to write marae_settings for ai_drafting toggle
create policy "marae_settings: trustees insert" on public.marae_settings
  for insert to authenticated with check (true);

create policy "marae_settings: trustees update" on public.marae_settings
  for update to authenticated using (is_trustee());

create policy "marae_settings: trustees delete" on public.marae_settings
  for delete to authenticated using (is_trustee());
