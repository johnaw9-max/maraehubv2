import { needsApplicabilityAnswer, applicabilityQuestion } from './complianceApplicability';

describe('applicability answer', () => {
  test('only open legal-if-it-applies items need an answer', () => {
    expect(needsApplicabilityAnswer({ framework_class: 'conditional_legal', applies: 'not_answered' })).toBe(true);
    expect(needsApplicabilityAnswer({ framework_class: 'conditional_legal', applies: 'yes' })).toBe(false);
    expect(needsApplicabilityAnswer({ framework_class: 'conditional_legal', applies: 'no' })).toBe(false);
    expect(needsApplicabilityAnswer({ framework_class: 'conditional_legal', applies: 'not_answered', not_applicable_at: '2026-11-26' })).toBe(false);
    expect(needsApplicabilityAnswer({ framework_class: 'good_practice', applies: 'not_answered' })).toBe(false);
  });
  test('question uses the item test, else the legal basis', () => {
    expect(applicabilityQuestion({ applicability_test: 'Does the marae employ anyone?' })).toBe('Does the marae employ anyone?');
    expect(applicabilityQuestion({ legal_basis: 'Act X, if the marae lights any fire' })).toMatch(/if the marae lights any fire/);
    expect(applicabilityQuestion({})).toBe('Does this apply to your marae?');
  });
});
