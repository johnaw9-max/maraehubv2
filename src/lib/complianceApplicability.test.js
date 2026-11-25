import { needsApplicabilityAnswer, applicabilityQuestion } from './complianceApplicability';

describe('applicability answer', () => {
  test('only open legal-if-it-applies items need an answer', () => {
    expect(needsApplicabilityAnswer({ framework_class: 'conditional_legal', applies: 'not_answered' })).toBe(true);
    expect(needsApplicabilityAnswer({ framework_class: 'conditional_legal', applies: 'yes' })).toBe(false);
    expect(needsApplicabilityAnswer({ framework_class: 'conditional_legal', applies: 'no' })).toBe(false);
    expect(needsApplicabilityAnswer({ framework_class: 'conditional_legal', applies: 'not_answered', not_applicable_at: '2026-11-26' })).toBe(false);
    expect(needsApplicabilityAnswer({ framework_class: 'good_practice', applies: 'not_answered' })).toBe(false);
    // a project whose database has no 'applies' column: no button that cannot save
    expect(needsApplicabilityAnswer({ framework_class: 'conditional_legal' })).toBe(false);
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

import { groupOpenQuestions } from './complianceApplicability';
describe('group open questions', () => {
  const mk = (id, q, extra = {}) => ({ id, framework_class: 'conditional_legal', applies: 'not_answered', applicability_test: q, ...extra });
  test('one group per question, biggest first, answered and question-less items left out', () => {
    const g = groupOpenQuestions([
      mk('a', 'Is the marae on the Charities Register?'),
      mk('b', 'Does the marae employ anyone on an employment agreement?'),
      mk('c', 'Does the marae employ anyone on an employment agreement?'),
      mk('d', 'Does the marae employ anyone on an employment agreement?', { applies: 'yes' }),
      mk('e', ''),
    ]);
    expect(g.map(x => x.items.length)).toEqual([2, 1]);
    expect(g[0].question).toMatch(/employ anyone/);
    expect(g[0].help).not.toBe('');
  });
});

import { applicabilityPlain } from './complianceApplicability';
describe('plain wording', () => {
  test('every known question has plain wording with a why; the item question uses it; groups carry it', () => {
    const qs = [
      'Is the marae land set apart as a Māori reservation under Te Ture Whenua Māori Act 1993, with trustees appointed by the Māori Land Court?',
      'Does the marae employ anyone on an employment agreement?',
      'Is the building a relevant building under the Fire and Emergency Act 2017 and the 2018 Regulations (Schedule 2)?',
      'Does the marae supply drinking water to others, making it a supplier under the Water Services Act 2021 (confirm with Taumata Arowai)?',
      'Does a building have a specified system, such as a fire alarm, on a compliance schedule?',
      'Is the marae on the Charities Register?',
      'Is the marae a trust to which the Trusts Act 2019 applies?',
    ];
    qs.forEach(q => { const p = applicabilityPlain({ applicability_test: q }); expect(p.question.length).toBeGreaterThan(10); expect(p.why.length).toBeGreaterThan(10); });
    expect(applicabilityQuestion({ applicability_test: qs[5] })).toBe('Is the marae a registered charity?');
    const g = groupOpenQuestions([{ id: 'a', framework_class: 'conditional_legal', applies: 'not_answered', applicability_test: qs[1] }]);
    expect(g[0].plainQuestion).toMatch(/pay anyone/);
    expect(g[0].question).toBe(qs[1]);
    expect(applicabilityPlain({ applicability_test: 'Something else?' })).toBeNull();
  });
});
