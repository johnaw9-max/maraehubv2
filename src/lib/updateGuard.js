// Lets a screen say "do not reload this page right now" (a live meeting view, voice
// dictation). The new-version updater checks this before it reloads by itself.
const holds = new Set();

export function holdUpdates(reason) {
  const token = Symbol(reason);
  holds.add(token);
  return () => holds.delete(token);
}

export function updatesHeld() {
  return holds.size > 0;
}
