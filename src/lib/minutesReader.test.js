jest.mock('./supabase', () => ({ supabase: { from: jest.fn() } }));
jest.mock('./audit', () => ({ logAudit: jest.fn() }));
jest.mock('./taskSync', () => ({ ensureTask: jest.fn().mockResolvedValue(undefined) }));

import { supabase } from './supabase';
import { ensureTask } from './taskSync';
import { buildPayload, groupByKind, saveSuggestion } from './minutesReader';

const meeting = { id: 'm1', title: 'Hui A', meeting_date: '2026-02-24', entity_id: null };

describe('groupByKind', () => {
  it('groups by kind in a fixed order and drops unknown kinds', () => {
    const g = groupByKind([
      { kind: 'grant', funder: 'F' }, { kind: 'task', description: 'a' },
      { kind: 'nonsense' }, { kind: 'task', description: 'b' },
    ]);
    expect(g.map(x => x.kind)).toEqual(['task', 'grant']);
    expect(g[0].items.map(i => i.description)).toEqual(['a', 'b']);
  });
});

describe('buildPayload', () => {
  it('task becomes an Open meeting action with nothing guessed', () => {
    const p = buildPayload('task', { description: ' Get quotes ', assigned_to: null, due_date: null }, meeting);
    expect(p).toMatchObject({ meeting_id: 'm1', description: 'Get quotes', assigned_to: null, due_date: null, status: 'Open' });
  });
  it('risk is rated by the shared rule and starts Open with no review date', () => {
    const p = buildPayload('risk', { description: 'Leak', category: 'Health & Safety', likelihood: 'Medium', consequence: 'High', controls: null, owner: null }, meeting);
    expect(p.risk_rating).toBe('High');
    expect(p.status).toBe('Open');
    expect(p.review_date).toBeNull();
    expect(p.notes).toContain('Hui A');
    expect(p.notes).toContain('estimate');
  });
  it('every kind that has a notes field keeps the hui and the exact quote', () => {
    const q = 'The roof leaks in the wharekai';
    const risk = buildPayload('risk', { description: 'Leak', category: 'Governance', likelihood: 'Low', consequence: 'Low', quote: q }, meeting);
    const asset = buildPayload('asset', { name: 'Chiller', category: 'Equipment', quote: q }, meeting);
    const grant = buildPayload('grant', { name: 'F', funder: 'F', category: 'Community', quote: q }, meeting);
    const decision = buildPayload('decision', { description: 'Agreed', quote: q }, meeting);
    [risk, asset, grant, decision].forEach(p => {
      expect(p.notes).toContain('Hui A (2026-02-24)');
      expect(p.notes).toContain(q);
    });
  });
  it('asset says the condition was not stated', () => {
    const p = buildPayload('asset', { name: 'Chiller', category: 'Equipment', notes: 'needs service' }, meeting);
    expect(p.condition).toBe('good');
    expect(p.notes).toContain('Condition not stated');
    expect(p.notes).toContain('needs service');
  });
  it('grant starts as researching with the stated amount only', () => {
    const p = buildPayload('grant', { name: 'Fund', funder: 'Trust', amount: 5000, category: 'Community', deadline: null, notes: null }, meeting);
    expect(p).toMatchObject({ status: 'researching', amount: 5000, funder: 'Trust', deadline: null });
  });
  it('decision is Active and dated from the hui', () => {
    const p = buildPayload('decision', { description: 'Agreed to buy mower' }, meeting);
    expect(p).toMatchObject({ status: 'Active', date_passed: '2026-02-24', meeting_id: 'm1' });
  });
  it('unknown kind gives null', () => {
    expect(buildPayload('x', {}, meeting)).toBeNull();
  });
});

describe('saveSuggestion', () => {
  function mockInsert(result) {
    const select = jest.fn().mockResolvedValue(result);
    const insert = jest.fn().mockReturnValue({ select });
    supabase.from.mockReturnValue({ insert });
    return insert;
  }
  beforeEach(() => { jest.clearAllMocks(); });

  it('saves a job as a meeting action and puts it on the Task Board', async () => {
    mockInsert({ data: [{ id: 'a1' }], error: null });
    const r = await saveSuggestion({ kind: 'task', description: 'Get quotes', assigned_to: 'Rota', due_date: null, quote: 'Rota to get quotes' }, meeting);
    expect(r.ok).toBe(true);
    expect(supabase.from).toHaveBeenCalledWith('meeting_actions');
    expect(ensureTask).toHaveBeenCalledTimes(1);
    expect(ensureTask.mock.calls[0][0].description).toContain('Rota to get quotes');
    expect(ensureTask.mock.calls[0][0].description).toContain('[source_id:a1]');
  });
  it('saves a risk without creating a task', async () => {
    mockInsert({ data: [{ id: 'r1' }], error: null });
    const r = await saveSuggestion({ kind: 'risk', description: 'Leak', category: 'Governance', likelihood: 'Low', consequence: 'Low' }, meeting);
    expect(r.ok).toBe(true);
    expect(supabase.from).toHaveBeenCalledWith('risk_register');
    expect(ensureTask).not.toHaveBeenCalled();
  });
  it('reports a database error and does not touch the Task Board', async () => {
    mockInsert({ data: null, error: { message: 'nope' } });
    const r = await saveSuggestion({ kind: 'task', description: 'x' }, meeting);
    expect(r).toEqual({ ok: false, message: 'nope' });
    expect(ensureTask).not.toHaveBeenCalled();
  });
  it('treats an empty result as no permission', async () => {
    mockInsert({ data: [], error: null });
    const r = await saveSuggestion({ kind: 'asset', name: 'Mower', category: 'Equipment' }, meeting);
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/permission/);
  });
});
