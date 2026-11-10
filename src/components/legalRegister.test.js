import { SOURCES } from './BuildingCompliance';

const fs = require('fs');
const path = require('path');
const register = JSON.parse(fs.readFileSync(path.join(__dirname, '../../docs/legal-claims-register.json'), 'utf8'));

test('every claim has an id, https source, and a key phrase if monitored', () => {
  const ids = new Set();
  register.claims.forEach(c => {
    expect(c.id && !ids.has(c.id)).toBeTruthy();
    ids.add(c.id);
    expect(c.sourceUrl).toMatch(/^https:\/\//);
    expect(c.claim.length).toBeGreaterThan(10);
    if (c.monitor) expect(c.keyPhrase.length).toBeGreaterThan(10);
  });
});

test('every source link shown in the app is in the register, and the other way round', () => {
  const regUrls = new Set(register.claims.map(c => c.sourceUrl));
  SOURCES.forEach(s => expect(regUrls.has(s.url)).toBe(true));
  const appUrls = new Set(SOURCES.map(s => s.url));
  regUrls.forEach(u => expect(appUrls.has(u)).toBe(true));
});
