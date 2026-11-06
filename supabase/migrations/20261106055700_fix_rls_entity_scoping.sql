-- Fix audit_log RLS policy to handle rows with null entity_id gracefully
-- Opeke-specific fix applied after initial audit_log rollout
drop policy if exists "trustees_read_own_entity_audit_log" on public.audit_log;

create policy "trustees_read_own_entity_audit_log" on public.audit_log
  for select using (
    (entity_id is null) or is_entity_member(entity_id)
  );
