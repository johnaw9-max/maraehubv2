import { supabase } from './supabase';
import { logAudit } from './audit';
import { ensureTask } from './taskSync';
import { calcRating } from './riskRating';

// Minutes reader (AI secretary, Tier 1 add-on). The AI only SUGGESTS. Nothing here
// runs until a named trustee ticks an item and presses Save. Each kind is saved with
// the same fields the normal screen uses, so the rest of the app treats it the same.

export const KIND_LABELS = {
  task: 'Job',
  risk: 'Risk',
  asset: 'Asset',
  grant: 'Grant',
  decision: 'Decision',
};

export const KIND_ORDER = ['task', 'risk', 'asset', 'grant', 'decision'];

export function groupByKind(suggestions) {
  const groups = {};
  (suggestions || []).forEach((s, index) => {
    if (!KIND_LABELS[s.kind]) return;
    (groups[s.kind] = groups[s.kind] || []).push({ ...s, _id: index });
  });
  return KIND_ORDER.filter(k => groups[k]).map(k => ({ kind: k, items: groups[k] }));
}

// The source note kept with every item: which hui, and the exact line it came from.
export function fromHui(meeting, quote) {
  const hui = `From the minutes of ${meeting.title}${meeting.meeting_date ? ' (' + meeting.meeting_date + ')' : ''}`;
  return quote ? `${hui}: \u201C${quote}\u201D.` : `${hui}.`;
}

// Pure: the row each kind is saved as. No database calls, so it can be tested.
export function buildPayload(kind, item, meeting) {
  switch (kind) {
    case 'task':
      return {
        meeting_id: meeting.id,
        description: item.description.trim(),
        assigned_to: item.assigned_to ? item.assigned_to.trim() : null,
        due_date: item.due_date || null,
        status: 'Open',
        resolution_id: null,
      };
    case 'decision':
      return {
        meeting_id: meeting.id,
        resolution_number: null,
        description: item.description.trim(),
        date_passed: meeting.meeting_date || null,
        status: 'Active',
        notes: fromHui(meeting, item.quote),
        linked_document_id: null,
      };
    case 'risk':
      return {
        risk_description: item.description.trim(),
        category: item.category,
        likelihood: item.likelihood,
        consequence: item.consequence,
        risk_rating: calcRating(item.likelihood, item.consequence),
        controls: item.controls ? item.controls.trim() : null,
        owner: item.owner ? item.owner.trim() : null,
        review_date: null,
        status: 'Open',
        notes: `${fromHui(meeting, item.quote)} Likelihood and consequence are an estimate. Please check them.`,
        entity_id: null,
        asset_id: null,
        compliance_item_id: null,
        source_meeting_id: meeting.id,
      };
    case 'asset':
      return {
        name: item.name.trim(),
        category: item.category,
        location: '',
        condition: 'good',
        notes: `${fromHui(meeting, item.quote)}${item.notes ? ' ' + item.notes.trim() : ''} Condition not stated: please check.`,
        value: null, purchase_cost: null, lifespan_years: null, replacement_cost: null,
        purchase_date: null, inventory_category: null, quantity: null, last_stocktake: null,
        entity_id: null, linked_document_id: null,
        source_meeting_id: meeting.id,
      };
    case 'grant':
      return {
        name: item.name.trim(),
        funder: item.funder.trim(),
        amount: item.amount != null ? item.amount : null,
        category: item.category,
        status: 'researching',
        deadline: item.deadline || null,
        notes: `${fromHui(meeting, item.quote)}${item.notes ? ' ' + item.notes.trim() : ''}`,
        source_meeting_id: meeting.id,
      };
    default:
      return null;
  }
}

const TABLE = { task: 'meeting_actions', decision: 'resolutions', risk: 'risk_register', asset: 'assets', grant: 'grants' };
const NAME_FIELD = { task: 'description', decision: 'description', risk: 'risk_description', asset: 'name', grant: 'name' };

// Saves one ticked suggestion. Returns { ok: true } or { ok: false, message }.
export async function saveSuggestion(item, meeting) {
  const payload = buildPayload(item.kind, item, meeting);
  if (!payload) return { ok: false, message: 'Unknown item type' };
  const { data, error } = await supabase.from(TABLE[item.kind]).insert(payload).select();
  if (error) return { ok: false, message: error.message };
  if (!data || data.length === 0) return { ok: false, message: 'You may not have permission to add this' };
  const saved = data[0];

  // A job also goes onto the Task Board, the same way a hui action does. No email is sent.
  if (item.kind === 'task') {
    await ensureTask({
      title: `ACTION: ${payload.description.slice(0, 80)}`,
      description: `Meeting action assigned. Hui: ${meeting.title}${meeting.meeting_date ? ' (' + meeting.meeting_date + ')' : ''}. Due: ${payload.due_date || 'no due date'}.${item.quote ? ' From the minutes: \u201C' + item.quote + '\u201D.' : ''} [source_id:${saved.id}] [source_meeting:${meeting.id}]`,
      assigned_to: payload.assigned_to,
      due_date: payload.due_date,
      priority: 'Medium',
    });
  }

  logAudit({
    entityId: meeting.entity_id || null,
    action: 'create',
    resourceType: TABLE[item.kind],
    resourceId: saved.id,
    resourceName: String(payload[NAME_FIELD[item.kind]] || '').slice(0, 120),
    metadata: { via: 'minutes_reader', meeting_id: meeting.id },
  });
  return { ok: true };
}
