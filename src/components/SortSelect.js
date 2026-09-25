import React from 'react';

// Consistent Sort (14yhc7kpea4) Step 4, Part 2. One shared control reused by
// every module -- the option list is deliberately per-module (passed in),
// not identical everywhere: not every module has a real field to back every
// mode (e.g. Compliance/Goals/Grants/Projects have no priority/rating
// field), so a module's `options` array only lists what it can actually
// honor rather than showing a no-op control.
export default function SortSelect({ value, onChange, options }) {
  return (
    <select
      className="form-input"
      style={{ width: 'auto', fontSize: 14 }}
      value={value}
      onChange={e => onChange(e.target.value)}
    >
      {options.map(opt => (
        <option key={opt.value} value={opt.value}>Sort: {opt.label}</option>
      ))}
    </select>
  );
}
