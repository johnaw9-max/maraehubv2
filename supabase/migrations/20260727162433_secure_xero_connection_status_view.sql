-- Closes an RLS-bypass hole in xero_connection_status found during direct
-- verification of the xero_connections migration (20260727065431). The view
-- was owned by postgres (which has rolbypassrls=true) and Supabase's default
-- schema privileges gave anon/authenticated full INSERT/UPDATE/DELETE grants
-- on it, so an UPDATE/DELETE through the view bypassed xero_connections'
-- zero-policy RLS entirely. security_invoker makes the view enforce RLS as
-- the querying role, not the owner; the revoke/grant removes the write
-- vector at the privilege level too, independent of RLS.

alter view xero_connection_status set (security_invoker = true);

revoke all on xero_connection_status from anon, authenticated;
grant select on xero_connection_status to authenticated;
