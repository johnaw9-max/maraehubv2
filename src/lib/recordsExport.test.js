/** @jest-environment node */
import { createZip, crc32 } from './zipStore';
import { csvCell, toCsv, buildReadme, buildRecordsExport, fetchAllRows } from './recordsExport';

// ── a tiny zip reader, so the tests check the real bytes, not our own writer ──
function readZip(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const eocd = bytes.length - 22;
  expect(view.getUint32(eocd, true)).toBe(0x06054B50);
  const count = view.getUint16(eocd + 10, true);
  let p = view.getUint32(eocd + 16, true);
  const out = {};
  for (let i = 0; i < count; i++) {
    expect(view.getUint32(p, true)).toBe(0x02014B50);
    const crc = view.getUint32(p + 16, true);
    const size = view.getUint32(p + 24, true);
    const nameLen = view.getUint16(p + 28, true);
    const localAt = view.getUint32(p + 42, true);
    const name = new TextDecoder().decode(bytes.slice(p + 46, p + 46 + nameLen));
    expect(view.getUint32(localAt, true)).toBe(0x04034B50);
    const lNameLen = view.getUint16(localAt + 26, true);
    const dataAt = localAt + 30 + lNameLen;
    const data = bytes.slice(dataAt, dataAt + size);
    expect(crc32(data)).toBe(crc);
    out[name] = new TextDecoder().decode(data);
    p += 46 + nameLen;
  }
  return out;
}

describe('createZip', () => {
  test('crc32 matches the standard check value', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xCBF43926);
  });

  test('round-trips names and contents, including macrons', () => {
    const zip = createZip([
      { name: 'a.txt', data: 'hello' },
      { name: 'records/Māori ā.csv', data: 'tēnā koe' },
      { name: 'empty.txt', data: '' },
    ]);
    expect(readZip(zip)).toEqual({ 'a.txt': 'hello', 'records/Māori ā.csv': 'tēnā koe', 'empty.txt': '' });
  });
});

describe('csvCell and toCsv', () => {
  test('quotes commas, quotes and line breaks', () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('line1\nline2')).toBe('"line1\nline2"');
  });

  test('null is empty, objects become JSON, numbers and booleans are plain', () => {
    expect(csvCell(null)).toBe('');
    expect(csvCell(undefined)).toBe('');
    expect(csvCell(12.5)).toBe('12.5');
    expect(csvCell(false)).toBe('false');
    expect(csvCell({ a: 1 })).toBe('"{""a"":1}"');
  });

  test('text a spreadsheet could run as a formula gets an apostrophe; plain numbers do not', () => {
    expect(csvCell('=SUM(A1:A9)')).toBe("'=SUM(A1:A9)");
    expect(csvCell('@cmd')).toBe("'@cmd");
    expect(csvCell('+1 call')).toBe("'+1 call");
    expect(csvCell('-note')).toBe("'-note");
    expect(csvCell('-12.50')).toBe('-12.50');
    expect(csvCell(-12.5)).toBe('-12.5');
  });

  test('starts with a byte-order mark and uses the union of columns in first-seen order', () => {
    const csv = toCsv([{ id: 1, name: 'A' }, { id: 2, extra: 'x' }]);
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv).toBe('﻿id,name,extra\r\n1,A,\r\n2,,x\r\n');
  });

  test('an empty table gives an empty file, not an error', () => {
    expect(toCsv([])).toBe('\uFEFF\r\n');
  });
});

// ── a fake database client ──
function fakeSupabase(tables) {
  return {
    from(table) {
      const state = { table, from: 0, to: 999 };
      const chain = {
        select() { return chain; },
        order() { return chain; },
        range(a, b) { state.from = a; state.to = b; return chain; },
        then(resolve) {
          const t = tables[table];
          if (t && t.error) return resolve({ data: null, error: t.error });
          if (!t) return resolve({ data: null, error: { code: '42P01', message: `relation "${table}" does not exist` } });
          resolve({ data: t.rows.slice(state.from, state.to + 1), error: null });
        },
      };
      return chain;
    },
  };
}

describe('fetchAllRows', () => {
  test('reads past the 1000-row page limit', async () => {
    const rows = Array.from({ length: 2345 }, (_, i) => ({ id: i }));
    const res = await fetchAllRows(fakeSupabase({ big: { rows } }), 'big');
    expect(res.error).toBeNull();
    expect(res.rows).toHaveLength(2345);
    expect(res.rows[2344].id).toBe(2344);
  });

  test('exactly one full page does not loop forever', async () => {
    const rows = Array.from({ length: 1000 }, (_, i) => ({ id: i }));
    const res = await fetchAllRows(fakeSupabase({ t: { rows } }), 't');
    expect(res.rows).toHaveLength(1000);
  });
});

describe('buildRecordsExport', () => {
  const now = new Date('2026-11-14T00:00:00Z'); // 14 Nov 2026, 1pm in New Zealand
  const tables = [
    { table: 'meetings', label: 'Hui and minutes' },
    { table: 'resolutions', label: 'Resolutions' },
    { table: 'missing_one', label: 'Not on this marae' },
    { table: 'denied_one', label: 'Admin only' },
  ];
  const db = fakeSupabase({
    meetings: { rows: [{ id: 'm1', title: 'Tēnā koe hui', minutes: 'Line one,\nline two' }] },
    resolutions: { rows: [] },
    denied_one: { error: { code: '42501', message: 'permission denied for table denied_one' } },
  });

  test('zip holds a read-me and one file per readable table; missing and denied tables are listed, not hidden', async () => {
    const { bytes, filename, results } = await buildRecordsExport({
      supabase: db, maraeName: 'Te Marae o Tāne', exportedBy: 'trustee@example.com', now, tables,
    });
    expect(filename).toBe('maraehub-records-te-marae-o-tane-2026-11-14.zip');
    const files = readZip(bytes);
    expect(Object.keys(files).sort()).toEqual(['READ ME FIRST.txt', 'records/meetings.csv', 'records/resolutions.csv']);
    expect(files['records/meetings.csv']).toContain('Tēnā koe hui');
    expect(files['records/meetings.csv']).toContain('"Line one,\nline two"');
    const readme = files['READ ME FIRST.txt'];
    expect(readme).toContain('TE MARAE O TĀNE');
    expect(readme).toContain('trustee@example.com');
    expect(readme).toContain('meetings.csv: Hui and minutes (1 row)');
    expect(readme).toContain('resolutions.csv: Resolutions (0 rows)');
    expect(readme).toContain('Not on this marae: not on this marae');
    expect(readme).toContain('Admin only: not available to your login');
    expect(results.map(r => r.status)).toEqual(['ok', 'ok', 'skipped', 'skipped']);
  });

  test('an unexpected database error stops the export instead of giving a quietly incomplete copy', async () => {
    const broken = fakeSupabase({ meetings: { error: { code: '500', message: 'connection reset' } } });
    await expect(buildRecordsExport({ supabase: broken, maraeName: 'X', now, tables: [{ table: 'meetings', label: 'Hui and minutes' }] }))
      .rejects.toThrow('Could not read Hui and minutes');
  });

  test('reports progress', async () => {
    const seen = [];
    await buildRecordsExport({ supabase: db, maraeName: 'X', now, tables, onProgress: p => seen.push(p.done) });
    expect(seen[0]).toBe(0);
    expect(seen[seen.length - 1]).toBe(tables.length);
  });

  test('readme says plainly that uploaded files are not in the copy', () => {
    const readme = buildReadme({ maraeName: 'X', now, results: [] });
    expect(readme).toContain('NOT IN THIS COPY');
    expect(readme).toContain('uploaded');
  });
});

import { copyReminderText } from './recordsExport';
describe('copyReminderText', () => {
  const now = new Date('2026-11-14T00:00:00Z');
  test('never downloaded: says so plainly', () => {
    expect(copyReminderText(null, now)).toMatch(/does not have its own copy/);
  });
  test('recent copy: no reminder', () => {
    expect(copyReminderText('2026-11-10T00:00:00Z', now)).toBeNull();
    expect(copyReminderText('2026-10-10T00:00:00Z', now)).toBeNull(); // 35 days: still fine
  });
  test('old copy: says how many days and the date', () => {
    const t = copyReminderText('2026-09-14T00:00:00Z', now);
    expect(t).toMatch(/downloaded 61 days ago \(14 September 2026\)/);
  });
});
