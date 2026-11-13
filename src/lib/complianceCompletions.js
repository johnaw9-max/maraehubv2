import { supabase } from './supabase';

// Writes one row to the compliance history ("when was this actually done") every time a
// compliance item is completed, from ANY route: the ✓ Done button, completing its OVERDUE
// task on the Task Board, or marking a linked asset service done.
//
// Best-effort by design: it never throws and never blocks the action that called it, so a
// marae that has not received the history table yet (or a failed save) loses nothing but the
// history row. Returns true if a row was saved or one already existed for that day.
export async function recordCompletion({ itemId, entityId, doneOn, doneBy, doneByUser }) {
  try {
    if (!itemId) return false;
    const day = doneOn || new Date().toISOString().split('T')[0];

    // Same item, same day, already logged by a "done" action -> do not double-count
    // (e.g. the task was completed and the Done button was also pressed).
    const { data: existing } = await supabase
      .from('compliance_completions').select('id')
      .eq('compliance_item_id', itemId).eq('done_on', day).eq('source', 'done_button')
      .limit(1);
    if (Array.isArray(existing) && existing.length > 0) return true;

    let uid = doneByUser || null;
    let name = doneBy || null;
    if (!uid) {
      const { data: { user } } = await supabase.auth.getUser();
      uid = user?.id || null;
    }
    if (uid && !name) {
      const { data: prof } = await supabase.from('profiles').select('full_name').eq('id', uid).maybeSingle();
      name = prof?.full_name || null;
    }
    let entity = entityId;
    if (entity === undefined) {
      const { data: it } = await supabase.from('compliance_items').select('entity_id').eq('id', itemId).maybeSingle();
      entity = it?.entity_id || null;
    }

    const { error } = await supabase.from('compliance_completions').insert({
      compliance_item_id: itemId, entity_id: entity || null, done_on: day,
      done_by: name, done_by_user: uid, source: 'done_button',
    });
    if (error) { console.warn('[complianceCompletions] history not recorded:', error.message); return false; }
    return true;
  } catch (e) {
    console.warn('[complianceCompletions] history not recorded:', e?.message);
    return false;
  }
}
