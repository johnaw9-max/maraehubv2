// "Does this apply to us?" for items that are a legal requirement only if a condition is true.
// The condition comes from the item itself (its applicability_test question, or the "if ..." in its
// legal basis). Pure functions, no network.

// True when the trustees still have to answer whether the item applies.
export function needsApplicabilityAnswer(item) {
  // The 'applies' column must exist on this marae's database (an item read from a project without it has no
  // 'applies' key); otherwise the Yes button could not save, so it is not shown.
  return !!item
    && 'applies' in item
    && item.framework_class === 'conditional_legal'
    && (item.applies === 'not_answered' || item.applies == null)
    && !item.not_applicable_at;
}

// The question to show the trustee. Falls back to the condition written in the legal basis.
export function applicabilityQuestion(item) {
  const plain = applicabilityPlain(item);
  if (plain) return plain.question;
  const q = effectiveTest(item);
  if (q) return q;
  const basis = String((item && item.legal_basis) || '').trim();
  return basis ? `Does this apply to your marae? The source says: ${basis}` : 'Does this apply to your marae?';
}

// Some items carry no question of their own in the database. Their condition is written in their legal basis, which reads
// badly on screen. Map each by item name to a question the app already knows, or to a new everyday one below.
const RES_Q = 'Is the marae land set apart as a Māori reservation under Te Ture Whenua Māori Act 1993, with trustees appointed by the Māori Land Court?';
const EMP_Q = 'Does the marae employ anyone on an employment agreement?';
const TEST_BY_NAME = {
  'Current list of trustees with appointment and term end dates': RES_Q,
  'Asbestos checked in any building built before 2000, with a management plan if it is present': EMP_Q,
  'Certificates of Compliance kept for any new or altered electrical work': 'EVENT: electrical work',
  'Fire season checked before lighting any outdoor fire (hāngī, bonfire, barbecue)': 'EVENT: outdoor fire',
  'Raffles and housie kept within the Department of Internal Affairs limits': 'EVENT: raffle or housie',
  'Special licence arranged for any event where alcohol is sold, or an entry fee or koha is charged': 'EVENT: alcohol at an event',
};

function effectiveTest(item) {
  const own = String((item && item.applicability_test) || '').trim();
  if (own) return own;
  return (item && TEST_BY_NAME[item.name]) || '';
}

// "How to find out" for each question. Every line only restates what the Framework (v0.4 and later) records from a
// source already read; where the Framework says a point is still to be verified, the line says so. Matched on the
// question text the items already carry. No match, no line.
const HOW_TO_FIND_OUT = [
  [/Māori reservation under Te Ture Whenua/i,
    'Record the legal status of the marae land and its governing document. Not every marae is a Māori reservation.'],
  [/employ anyone on an employment agreement/i,
    'Does the marae or its trust pay anyone on an employment agreement? Contractors do not count. If nobody is employed, the marae is a volunteer association, not a person running a business or undertaking.'],
  [/relevant building under the Fire and Emergency/i,
    'A relevant building is one where 100 or more people can gather, 10 or more work, or 6 or more can stay (other than 3 or fewer households). It is also one that stores hazardous substances above set amounts, or is an early childhood centre, a place of care or lawful detention. Whether "can gather" means capacity or actual use is still to be verified.'],
  [/supply drinking water to others/i,
    'Look at where your drinking water comes from: the town (council) supply, or your own tank, bore, roof or stream. Taumata Arowai says everyone who supplies drinking water to more than 25 people, for example from a bore or rainwater tank, has a legal responsibility to ensure it is safe to drink. If you use both, answer Yes. Confirm with Taumata Arowai.'],
  [/specified system, such as a fire alarm, on a compliance schedule/i,
    'A building needs a compliance schedule if it contains a specified system, such as sprinklers, an emergency warning system for fire, emergency lighting or a lift. Hand-held fire extinguishers are not listed.'],
  [/on the Charities Register/i,
    'Search for the marae by name on the Charities Register (charities.govt.nz).'],
  [/^EVENT: electrical work/, 'Think about the last year and the year ahead: has anyone rewired, added or altered electrical work at the marae, or will they?'],
  [/^EVENT: outdoor fire/, 'Think about hāngī, bonfires, burn-offs and barbecues. Check the fire season for your area before lighting any fire outdoors.'],
  [/^EVENT: raffle or housie/, 'Think about fundraisers: raffles, housie or similar games of chance, held by the marae or for it.'],
  [/^EVENT: alcohol at an event/, 'Think about events where alcohol is sold or supplied and people pay an entry fee or give koha, for example a fundraiser night or a hired event.'],
  [/Trusts Act 2019 applies/i,
    'Check the marae governing document to see whether the marae is held by a trust.'],
];

// Everyday wording for each question, with one line on why it is asked. The legal wording stays on the item and in the
// audit log; trustees see this. Matched on the same question text as the help lines above. No match, no plain wording.
const PLAIN = [
  [/Māori reservation under Te Ture Whenua/i,
    { question: 'Is your marae land a Māori reservation?', why: 'Special rules for reservation trustees apply only if it is.' }],
  [/employ anyone on an employment agreement/i,
    { question: 'Do you pay anyone to work for the marae, on an employment agreement?', why: 'Employer health and safety duties apply only if you do. A volunteer-only marae does not have them.' }],
  [/relevant building under the Fire and Emergency/i,
    { question: 'Is any building a "relevant building"? Usually that means 100 or more people can gather, 10 or more work there, or 6 or more can stay.', why: 'A relevant building must have an approved fire evacuation scheme.' }],
  [/supply drinking water to others/i,
    { question: 'Does your marae get its drinking water from its own tank, bore, roof or stream, rather than the town (council) supply? If you use both, answer Yes.',
      why: 'These duties fall on whoever owns or runs the supply (Taumata Arowai). With a town supply that is normally the council, so these items may not apply to you. With your own supply they may. Confirm with Taumata Arowai.',
      yesLabel: 'Yes, our own tank, bore, roof or stream', noLabel: 'No, the town (council) supply', noReason: 'Our water comes from the town (council) supply' }],
  [/specified system, such as a fire alarm, on a compliance schedule/i,
    { question: 'Does any building have a fire alarm, sprinklers, emergency lighting or a lift?', why: 'A building with one of these needs a compliance schedule and a yearly Building Warrant of Fitness.' }],
  [/on the Charities Register/i,
    { question: 'Is the marae a registered charity?', why: 'Registered charities must file a yearly return and report changes to Charities Services.' }],
  [/^EVENT: electrical work/,
    { question: 'Is any new or altered electrical work done at the marae, now or in future?', why: 'New or altered electrical work must be tested and certified, and the Certificate of Compliance kept.',
      yesLabel: 'Yes, it happens', noLabel: 'No, never', noReason: 'No electrical work is done at the marae' }],
  [/^EVENT: outdoor fire/,
    { question: 'Does the marae ever light a fire outdoors, such as a hāngī, bonfire or barbecue?', why: 'Lighting a fire in the open air is not allowed in a prohibited fire season, and needs a permit in a restricted season unless the fire type is authorised.',
      yesLabel: 'Yes, we do', noLabel: 'No, never', noReason: 'The marae never lights fires outdoors' }],
  [/^EVENT: raffle or housie/,
    { question: 'Does the marae run raffles, housie or similar fundraisers?', why: 'Raffles and housie have prize and turnover limits set by the Department of Internal Affairs.',
      yesLabel: 'Yes, we do', noLabel: 'No, never', noReason: 'The marae does not run raffles or housie' }],
  [/^EVENT: alcohol at an event/,
    { question: 'Is alcohol ever sold or supplied at a marae event where there is an entry fee or koha?', why: 'That needs a special licence from the council licensing committee, applied for at least 20 working days before the event.',
      yesLabel: 'Yes, it happens', noLabel: 'No, never', noReason: 'Alcohol is not sold at marae events' }],
  [/Trusts Act 2019 applies/i,
    { question: 'Is the marae held by a trust?', why: 'The Trusts Act sets duties for the trustees of a trust.' }],
];

export function applicabilityPlain(item) {
  const q = effectiveTest(item);
  if (!q) return null;
  const hit = PLAIN.find(([re]) => re.test(q));
  return hit ? hit[1] : null;
}

export function applicabilityHelp(item) {
  const q = effectiveTest(item);
  if (!q) return '';
  const hit = HOW_TO_FIND_OUT.find(([re]) => re.test(q));
  return hit ? hit[1] : '';
}

// Open questions grouped by their question text, so one answer covers every item that depends on it.
// Only items that carry a question of their own are grouped; others keep their per-item answer.
export function groupOpenQuestions(items) {
  const groups = new Map();
  for (const it of Array.isArray(items) ? items : []) {
    if (!needsApplicabilityAnswer(it)) continue;
    const q = effectiveTest(it);
    if (!q) continue;
    if (!groups.has(q)) { const pl = applicabilityPlain(it); groups.set(q, { question: q, plainQuestion: pl ? pl.question : q, why: pl ? pl.why : '', yesLabel: (pl && pl.yesLabel) || 'Yes, this applies to us', noLabel: (pl && pl.noLabel) || 'No, it does not apply', noReason: (pl && pl.noReason) || '', help: applicabilityHelp(it), items: [] }); }
    groups.get(q).items.push(it);
  }
  return [...groups.values()].sort((a, b) => b.items.length - a.items.length || a.question.localeCompare(b.question));
}

// What the trustees should check next: items that apply (or always apply) and have never been checked.
// Items still waiting for an applicability answer are left out, because we do not yet know they apply.
// Order: Start here (stage 1), then Next, then Later, then by name.
export function nextSteps(items, limit = 3) {
  const eligible = (Array.isArray(items) ? items : []).filter(it =>
    !it.not_applicable_at
    && it.applies !== 'no'
    && !needsApplicabilityAnswer(it)
    && !it.last_checked_date);
  eligible.sort((a, b) => (a.stage || 9) - (b.stage || 9) || String(a.name).localeCompare(String(b.name)));
  return { total: eligible.length, top: eligible.slice(0, limit) };
}
