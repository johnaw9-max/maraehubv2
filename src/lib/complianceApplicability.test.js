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

import { applicabilityHelp } from './complianceApplicability';
describe('how to find out', () => {
  test('each known question has a line, unknown or empty has none', () => {
    const qs = [
      'Is the marae land set apart as a Māori reservation under Te Ture Whenua Māori Act 1993, with trustees appointed by the Māori Land Court?',
      'Does the marae employ anyone on an employment agreement?',
      'Is the building a relevant building under the Fire and Emergency Act 2017 and the 2018 Regulations (Schedule 2)?',
      'Does the marae supply drinking water to others, making it a supplier under the Water Services Act 2021 (confirm with Taumata Arowai)?',
      'Does a building have a specified system, such as a fire alarm, on a compliance schedule?',
      'Is the marae on the Charities Register?',
      'Is the marae a trust to which the Trusts Act 2019 applies?',
    ];
    qs.forEach(q => expect(applicabilityHelp({ applicability_test: q })).not.toBe(''));
    expect(applicabilityHelp({ applicability_test: 'Something else?' })).toBe('');
    expect(applicabilityHelp({})).toBe('');
  });
});
