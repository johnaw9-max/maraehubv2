import { supabase } from './supabase';
import { DEFAULT_DOC_URL } from '../components/OnboardingFlow';

// Charter has no persisted "done" state of its own (CharterGenerator.js is a pure
// client-side print generator) — Stage 5 writes a documents row with this title
// so "Charter generated" becomes a real, data-backed item like everything else here.
export const CHARTER_DOCUMENT_TITLE = 'Marae Charter';

const ITEM_META = {
  maraeDetails:     { label: 'Marae details set',                navTo: 'settings' },
  trusteeInvited:   { label: 'Trustee invited',                  navTo: 'settings' },
  firstAsset:       { label: 'First asset added',                navTo: 'assets' },
  complianceItem:   { label: 'Compliance item tracked',          navTo: 'compliance' },
  emergencyPlan:    { label: 'Emergency Preparedness started',   navTo: 'emergency_plan' },
  documentUploaded: { label: 'Document uploaded',                navTo: 'documents' },
  firstHui:         { label: 'First hui recorded',               navTo: 'minutes' },
  charterGenerated: { label: 'Charter generated',                navTo: 'documents' },
};

export async function getGettingStartedStatus() {
  const [
    settingsRes,
    trusteesRes,
    assetsRes,
    complianceRes,
    hazardsRes,
    peopleRes,
    documentsRes,
    meetingsRes,
    charterRes,
  ] = await Promise.all([
    supabase.from('marae_settings').select('iwi, hapu').limit(1).single(),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'trustee'),
    supabase.from('assets').select('id', { count: 'exact', head: true }),
    // Excludes 'emergency_preparedness' — ComplianceTracker.js auto-seeds 7 rows in that
    // category the moment anyone opens the Compliance tab, so raw count is not a real signal.
    supabase.from('compliance_items').select('id', { count: 'exact', head: true }).neq('category', 'emergency_preparedness'),
    supabase.from('emergency_plan_hazards').select('id', { count: 'exact', head: true }),
    supabase.from('emergency_plan_people').select('id', { count: 'exact', head: true }),
    // Excludes the onboarding wizard's own auto-seeded template document.
    supabase.from('documents').select('id', { count: 'exact', head: true }).neq('file_url', DEFAULT_DOC_URL),
    // meetings, not bookings — bookings conflates venue hire with the onboarding
    // wizard's seeded "Trustee Hui" row; meetings is the app's real governance-hui table.
    supabase.from('meetings').select('id', { count: 'exact', head: true }),
    supabase.from('documents').select('id', { count: 'exact', head: true }).eq('title', CHARTER_DOCUMENT_TITLE),
  ]);

  const done = {
    maraeDetails:     !!(settingsRes.data?.iwi?.trim() && settingsRes.data?.hapu?.trim()),
    trusteeInvited:   (trusteesRes.count || 0) >= 2,
    firstAsset:       (assetsRes.count || 0) > 0,
    complianceItem:   (complianceRes.count || 0) > 0,
    emergencyPlan:    (hazardsRes.count || 0) > 0 || (peopleRes.count || 0) > 0,
    documentUploaded: (documentsRes.count || 0) > 0,
    firstHui:         (meetingsRes.count || 0) > 0,
    charterGenerated: (charterRes.count || 0) > 0,
  };

  const items = Object.keys(ITEM_META).map(key => ({ key, ...ITEM_META[key], done: done[key] }));
  const completed = items.filter(i => i.done).length;

  return { items, completed, total: items.length };
}
