// "Does this apply to us?" for items that are a legal requirement only if a condition is true.
// The condition comes from the item itself (its applicability_test question, or the "if ..." in its
// legal basis). Pure functions, no network.

// True when the trustees still have to answer whether the item applies.
export function needsApplicabilityAnswer(item) {
  return !!item
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
