import React from 'react';

// Shared compact row shell (14yhc7kw7dt Phase C1), extracted from Tasks'
// List view (TaskBoard.js) with no change to its own look. ListRow only
// owns layout -- every slot is a plain node the caller renders:
//   marker  -- checkbox, "Mark done" button, or similar, first on line one
//   chip    -- an optional status chip (interactive or display-only --
//              ListRow doesn't care which)
//   leading -- an optional small badge between the chip and the title.
//              Kept separate from `meta` so a module that, like Tasks,
//              shows a badge before the title isn't forced to reorder it
//              to after the title just to fit this component.
//   title   -- the row's one-line ellipsized title text
//   meta    -- up to three nodes rendered after the title (date, owner,
//              category, priority, etc. -- whatever the module needs)
//   menu    -- an overflow-menu slot, last in the meta group
//   onClick -- optional, for a whole-row click target (e.g. Compliance's
//              click-to-expand). Omit for a plain non-clickable row.
// Wraps to two lines under 640px: marker + chip + leading + title form
// line one, meta + menu form line two.
//
// Every slot is rendered with a trailing literal space between it and the
// next one. Flexbox `gap` already provides the real visual spacing and
// collapses whitespace-only text nodes, so this changes nothing on
// screen -- but adjacent inline elements with zero whitespace between
// them produce a single run-on string when copied as plain text (e.g. a
// "Mark done" button directly against an "Overdue" chip directly against
// an "Overdue Item" title linearizes to "Mark doneOverdueOverdue Item",
// which contains no word-boundary-delimited "Overdue" at all -- found via
// a real bug report, 14yhc7kw7dt). The literal space fixes that without
// touching layout.
export const LIST_ROW_RESPONSIVE_CSS = `
  @media (max-width: 640px) {
    .list-row { flex-wrap: wrap; }
    .list-row .list-row-primary,
    .list-row .list-row-meta { flex: 1 1 100%; }
    .list-row .list-row-meta { margin-top: 4px; }
  }
`;

export default function ListRow({ marker, chip, leading, title, titleStyle, meta = [], menu, onClick }) {
  return (
    <div
      className="list-row"
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 14px', borderBottom: '1px solid var(--border)', background: 'var(--surface)',
        ...(onClick ? { cursor: 'pointer' } : {}),
      }}
    >
      <div className="list-row-primary" style={{ display: 'flex', alignItems: 'center', gap: 10, flex: '1 1 auto', minWidth: 0 }}>
        {marker}{marker ? ' ' : null}
        {chip}{chip ? ' ' : null}
        {leading}{leading ? ' ' : null}
        <span style={{
          fontSize: 14, fontWeight: 600, color: 'var(--text1)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0,
          ...titleStyle,
        }}>
          {title}
        </span>
      </div>

      <div className="list-row-meta" style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        {meta.map((m, i) => (
          <React.Fragment key={i}>{m}{m ? ' ' : null}</React.Fragment>
        ))}
        {menu}
      </div>
    </div>
  );
}
