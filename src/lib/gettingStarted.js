import { supabase } from './supabase';
import { DEFAULT_DOC_URL } from '../components/OnboardingFlow';

// Charter has no persisted "done" state of its own (CharterGenerator.js is a pure
// client-side print generator) — Stage 5 writes a documents row with this title
// so "Charter generated" becomes a real, data-backed item like everything else here.
export const CHARTER_DOCUMENT_TITLE = 'Marae Charter';

// Real assets seeded by supabase/migrations/20260817050000_stage5_fire_assets_opeke.sql
// (confirmed via direct query: this is Opeke's entire assets register, 2 of 2 rows).
const SEEDED_ASSET_NAMES = ['Fire Extinguishers', 'Fire Alarms / Smoke Detectors'];

// Real compliance_items rows inserted by migration, not typed in by a trustee.
// Two sources — can't exclude by category alone since both use categories a real
// user could also add items under:
//  - supabase/migrations/20260611084210_create_compliance_tables.sql (10 baseline
//    items). Matched against the *current* live name, not the migration's original
//    text — 'Building Warrant of Fitness' was later renamed in place by the BWOF
//    rewrite work (ClickUp 86d44a27n), confirmed via direct query on Tineka.
//  - supabase/migrations/20260819030000_water_compliance_items.sql (3 water items).
//    A 4th, differently-worded water row ("Water tank test") exists on Tineka with
//    a different timestamp — that one is real and must NOT be excluded.
const SEEDED_COMPLIANCE_ITEM_NAMES = [
  'Emergency Contact List Update',
  'Building Warrant of Fitness — annual renewal (only if your building has a compliance schedule)',
  'Building & Contents Insurance',
  'Civil Defence Emergency Plan Review',
  'Public Liability Insurance',
  'Health & Safety Policy Review',
  'Trustee Elections / Term Review',
  'First Aid Kit Inspection',
  'Fire Extinguisher Service',
  'Emergency Evacuation Drill',
  "Drinking water testing and monitoring — confirmed against your supply's requirements",
  'Water treatment system — serviced and confirmed working (if applicable)',
  'Water supply classification and registration — confirmed with Taumata Arowai',
];

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
    peopleRes,
    documentsRes,
    meetingsRes,
    charterRes,
  ] = await Promise.all([
    supabase.from('marae_settings').select('iwi, hapu').limit(1).single(),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'trustee'),
    supabase.from('assets').select('name'),
    supabase.from('compliance_items').select('name').neq('category', 'emergency_preparedness'),
    // emergency_plan_hazards is deliberately not queried here — every row (and even
    // its likely_impact/what_to_do content) has been found migration-seeded on both
    // live projects, with no reliable way to tell a real edit from backfilled
    // boilerplate. emergency_plan_people is the only clean signal for this item.
    supabase.from('emergency_plan_people').select('id', { count: 'exact', head: true }),
    // Excludes the onboarding wizard's own auto-seeded template document.
    supabase.from('documents').select('id', { count: 'exact', head: true }).neq('file_url', DEFAULT_DOC_URL),
    // meetings, not bookings — bookings conflates venue hire with the onboarding
    // wizard's seeded "Trustee Hui" row; meetings is the app's real governance-hui table.
    supabase.from('meetings').select('id', { count: 'exact', head: true }),
    supabase.from('documents').select('id', { count: 'exact', head: true }).eq('title', CHARTER_DOCUMENT_TITLE),
  ]);

  const realAssets     = (assetsRes.data || []).filter(a => !SEEDED_ASSET_NAMES.includes(a.name));
  const realCompliance = (complianceRes.data || []).filter(c => !SEEDED_COMPLIANCE_ITEM_NAMES.includes(c.name));

  const done = {
    maraeDetails:     !!(settingsRes.data?.iwi?.trim() && settingsRes.data?.hapu?.trim()),
    trusteeInvited:   (trusteesRes.count || 0) >= 2,
    firstAsset:       realAssets.length > 0,
    complianceItem:   realCompliance.length > 0,
    emergencyPlan:    (peopleRes.count || 0) > 0,
    documentUploaded: (documentsRes.count || 0) > 0,
    firstHui:         (meetingsRes.count || 0) > 0,
    charterGenerated: (charterRes.count || 0) > 0,
  };

  const items = Object.keys(ITEM_META).map(key => ({ key, ...ITEM_META[key], done: done[key] }));
  const completed = items.filter(i => i.done).length;

  return { items, completed, total: items.length };
}
