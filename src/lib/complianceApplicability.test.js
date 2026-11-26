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

import { nextSteps } from './complianceApplicability';
describe('next steps', () => {
  const it = (name, extra = {}) => ({ name, framework_class: 'good_practice', applies: 'not_answered', ...extra });
  test('skips checked, not-applicable and still-unanswered items; Start here first', () => {
    const r = nextSteps([
      it('B later', { stage: 3 }),
      it('A start', { stage: 1 }),
      it('Checked', { stage: 1, last_checked_date: '2026-11-01' }),
      it('Not ours', { stage: 1, not_applicable_at: '2026-11-02' }),
      it('Waiting', { stage: 1, framework_class: 'conditional_legal', applies: 'not_answered' }),
      it('Yes item', { stage: 2, framework_class: 'conditional_legal', applies: 'yes' }),
    ], 2);
    expect(r.total).toBe(3);
    expect(r.top.map(x => x.name)).toEqual(['A start', 'Yes item']);
  });
});


describe('water question', () => {
  const q = 'Does the marae supply drinking water to others, making it a supplier under the Water Services Act 2021 (confirm with Taumata Arowai)?';
  test('asks where the water comes from, with its own button labels and a prefilled reason', () => {
    const g = groupOpenQuestions([{ id: 'a', framework_class: 'conditional_legal', applies: 'not_answered', applicability_test: q }]);
    expect(g[0].plainQuestion).toMatch(/tank, bore, roof or stream/);
    expect(g[0].plainQuestion).toMatch(/town \(council\) supply/);
    expect(g[0].yesLabel).toMatch(/own tank/);
    expect(g[0].noLabel).toMatch(/town/);
    expect(g[0].noReason.length).toBeGreaterThan(5);
    expect(applicabilityHelp({ applicability_test: q })).toMatch(/marae and community halls/);
  });
  test('other questions keep the default labels', () => {
    const g = groupOpenQuestions([{ id: 'a', framework_class: 'conditional_legal', applies: 'not_answered', applicability_test: 'Is the marae on the Charities Register?' }]);
    expect(g[0].yesLabel).toBe('Yes, this applies to us');
    expect(g[0].noLabel).toBe('No, it does not apply');
  });
});

describe('items without a question of their own', () => {
  const base = { framework_class: 'conditional_legal', applies: 'not_answered', applicability_test: null };
  test('trustee list joins the reservation question and asbestos joins the employees question', () => {
    const g = groupOpenQuestions([
      { ...base, id: 'a', name: 'Current list of trustees with appointment and term end dates' },
      { ...base, id: 'b', name: 'Asbestos checked in any building built before 2000, with a management plan if it is present' },
      { ...base, id: 'c', name: 'Annual meeting', applicability_test: 'Is the marae land set apart as a Māori reservation under Te Ture Whenua Māori Act 1993, with trustees appointed by the Māori Land Court?' },
    ]);
    const res = g.find(x => /Māori reservation/.test(x.plainQuestion));
    expect(res.items.map(i => i.id).sort()).toEqual(['a', 'c']);
    expect(g.find(x => /pay anyone/.test(x.plainQuestion)).items.map(i => i.id)).toEqual(['b']);
  });
  test('the four event items get everyday questions and their own button labels', () => {
    const names = [
      'Certificates of Compliance kept for any new or altered electrical work',
      'Fire season checked before lighting any outdoor fire (hāngī, bonfire, barbecue)',
      'Raffles and housie kept within the Department of Internal Affairs limits',
      'Special licence arranged for any event where alcohol is sold, or an entry fee or koha is charged',
    ];
    const g = groupOpenQuestions(names.map((name, i) => ({ ...base, id: 'e' + i, name })));
    expect(g.length).toBe(4);
    g.forEach(x => { expect(x.plainQuestion).not.toMatch(/The source says/); expect(x.why.length).toBeGreaterThan(20); expect(x.help.length).toBeGreaterThan(20); expect(x.noReason.length).toBeGreaterThan(5); });
    expect(applicabilityQuestion({ ...base, name: names[1] })).toMatch(/hāngī/);
  });
});

describe('written evacuation procedure has its own question', () => {
  test('is not grouped under the relevant building question', () => {
    const open = { framework_class: 'conditional_legal', applies: 'not_answered' };
    const g = groupOpenQuestions([
      { ...open, id: 'p', name: 'Written evacuation procedure', applicability_test: 'Is a building open to the public, such as a hall, wharekai or wharenui that people outside the whānau can use (Schedule 2 of the Fire Safety, Evacuation Procedures and Evacuation Schemes Regulations 2018)?' },
      { ...open, id: 'r', name: 'Emergency exits', applicability_test: 'Is the building a relevant building under the Fire and Emergency Act 2017 and the 2018 Regulations (Schedule 2)?' },
    ]);
    expect(g.length).toBe(2);
    expect(g.find(x => x.items[0].id === 'p').plainQuestion).toMatch(/open to the public/);
    expect(g.find(x => x.items[0].id === 'p').help).toMatch(/does not name marae/);
  });
});

describe('what a trustee reads under each question', () => {
  // Guard: no internal working notes and no points the Framework still marks "to verify".
  const BANNED = /still to be verified|not yet verified|to verify|partly (checked|confirmed)|TBD|Contractors do not count/i;
  const tests = [
    'Is the marae land set apart as a Māori reservation under Te Ture Whenua Māori Act 1993, with trustees appointed by the Māori Land Court?',
    'Does the marae employ anyone on an employment agreement?',
    'Is the building a relevant building under the Fire and Emergency Act 2017 and the 2018 Regulations (Schedule 2)?',
    'Does the marae supply drinking water to others, making it a supplier under the Water Services Act 2021 (confirm with Taumata Arowai)?',
    'Does a building have a specified system, such as a fire alarm, on a compliance schedule?',
    'Is the marae on the Charities Register?',
    'Is the marae a trust to which the Trusts Act 2019 applies?',
    'Is a building open to the public, such as a hall, wharekai or wharenui that people outside the whānau can use (Schedule 2 of the Fire Safety, Evacuation Procedures and Evacuation Schemes Regulations 2018)?',
    'EVENT: electrical work', 'EVENT: outdoor fire', 'EVENT: raffle or housie', 'EVENT: alcohol at an event',
  ];
  test.each(tests)('no internal notes in the explanation for: %s', (t) => {
    const g = groupOpenQuestions([{ id: 'x', name: 'x', framework_class: 'conditional_legal', applies: 'not_answered', applicability_test: t }])[0];
    expect(g.plainQuestion).not.toMatch(/The source says/);
    [g.plainQuestion, g.why, g.help].forEach(s => expect(s).not.toMatch(BANNED));
  });
});

describe('why we ask is available for every shared question', () => {
  const { applicabilityPlain } = require('./complianceApplicability');
  test('employment question has a why line for the contractor review', () => {
    const item = { name: 'Contractor Health & Safety Management Review', applicability_test: 'Does the marae employ anyone on an employment agreement?' };
    expect(applicabilityPlain(item).why).toMatch(/Employer health and safety duties apply only if you do/);
  });
});
