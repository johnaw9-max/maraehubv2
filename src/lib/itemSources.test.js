import { indexSources, sourcesForItem, safeUrl, isFullyChecked, sourceTag, hasSources } from './itemSources';

const ROWS = [
  { key: 'BA04', name: 'Building Act 2004', status: 'Verified – primary source', url: 'https://www.legislation.govt.nz/act/public/2004/0072/latest/whole.html' },
  { key: 'TA19', name: 'Trusts Act 2019', status: 'Verified – primary source (duties); application to a reservation To verify', url: '' },
  { key: 'WSOFF', name: 'WorkSafe: Officers', status: 'Verified – official guidance', url: '' },
];
const idx = indexSources(ROWS);

test('indexes by key and tolerates nothing', () => {
  expect(Object.keys(idx)).toEqual(['BA04', 'TA19', 'WSOFF']);
  expect(indexSources(null)).toEqual({});
});

test('returns an item\'s sources in its own order and skips unknown keys', () => {
  expect(sourcesForItem({ source_keys: ['TA19', 'NOPE', 'BA04'] }, idx).map(s => s.key)).toEqual(['TA19', 'BA04']);
  expect(sourcesForItem({}, idx)).toEqual([]);
  expect(sourcesForItem({ source_keys: null }, idx)).toEqual([]);
});

test('only secure links are used', () => {
  expect(safeUrl('https://example.org/a')).toBe('https://example.org/a');
  expect(safeUrl('http://example.org')).toBe('');
  expect(safeUrl('javascript:alert(1)')).toBe('');
  expect(safeUrl('')).toBe('');
});

test('a source with an open point is never called fully checked', () => {
  expect(isFullyChecked(ROWS[0])).toBe(true);
  expect(isFullyChecked(ROWS[1])).toBe(false);
  expect(isFullyChecked({ status: 'To verify' })).toBe(false);
});

test('row tag: none without a source, partly checked if any source has an open point', () => {
  expect(sourceTag({ source_keys: [] }, idx)).toBeNull();
  expect(sourceTag({ source_keys: ['BA04'] }, idx)).toBe('Source checked');
  expect(sourceTag({ source_keys: ['BA04', 'TA19'] }, idx)).toBe('Source partly checked');
  expect(hasSources({ source_keys: ['BA04'] })).toBe(true);
  expect(hasSources({ source_keys: [] })).toBe(false);
});
