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
  const q = String((item && item.applicability_test) || '').trim();
  if (q) return q;
  const basis = String((item && item.legal_basis) || '').trim();
  return basis ? `Does this apply to your marae? The source says: ${basis}` : 'Does this apply to your marae?';
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
    'Taumata Arowai says everyone who supplies drinking water to more than 25 people has a legal responsibility to ensure it is safe to drink. Confirm with Taumata Arowai.'],
  [/specified system, such as a fire alarm, on a compliance schedule/i,
    'A building needs a compliance schedule if it contains a specified system, such as sprinklers, an emergency warning system for fire, emergency lighting or a lift. Hand-held fire extinguishers are not listed.'],
  [/on the Charities Register/i,
    'Search for the marae by name on the Charities Register (charities.govt.nz).'],
  [/Trusts Act 2019 applies/i,
    'Check the marae governing document to see whether the marae is held by a trust.'],
];

export function applicabilityHelp(item) {
  const q = String((item && item.applicability_test) || '');
  if (!q) return '';
  const hit = HOW_TO_FIND_OUT.find(([re]) => re.test(q));
  return hit ? hit[1] : '';
}
