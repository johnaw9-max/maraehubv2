import { supabase } from './supabase';

/**
 * Fire-and-forget audit log entry.
 * Never throws — a logging failure must never break the user's action.
 *
 * @param {object} params
 * @param {string} params.entityId       - The marae entity UUID
 * @param {string} params.action         - 'view'|'upload'|'download'|'create'|'update'|'delete'
 * @param {string} params.resourceType   - e.g. 'document', 'finance_receipt', 'incident', 'compliance_doc', 'trustee'
 * @param {string} [params.resourceId]   - UUID or identifier of the record
 * @param {string} [params.resourceName] - Human-readable label (e.g. file name)
 * @param {object} [params.metadata]     - Any extra context (old values, file size, etc.)
 */
export async function logAudit({
  entityId,
  action,
  resourceType,
  resourceId = null,
  resourceName = null,
  metadata = {},
}) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return; // not logged in — nothing to log

    await supabase.from('audit_log').insert({
      entity_id:     entityId,
      user_id:       user.id,
      user_email:    user.email,
      action,
      resource_type: resourceType,
      resource_id:   resourceId   ? String(resourceId)   : null,
      resource_name: resourceName ? String(resourceName) : null,
      metadata,
    });
    // ignore result — fire and forget
  } catch {
    // silent — logging must never break the app
  }
}
