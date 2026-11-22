import React from 'react';
import { sourcesForItem, safeUrl, NO_SOURCE_NOTE } from '../lib/itemSources';

// The "Sources" block inside an item's Details: name, what was read, version and date read,
// how far it is checked, and the official link. Shows an honest note when there is no source.
export default function ItemSources({ item, sourcesByKey }) {
  const list = sourcesForItem(item, sourcesByKey);
  if (list.length === 0) {
    return (
      <div data-testid="item-sources-none" style={{ marginTop: 8, fontSize: 13, color: 'var(--text3)' }}>
        {NO_SOURCE_NOTE}
      </div>
    );
  }
  return (
    <div data-testid="item-sources" style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>{list.length === 1 ? 'Source' : 'Sources'}</div>
      {list.map(s => {
        const link = safeUrl(s.url);
        return (
          <div key={s.key} data-testid={`item-source-${s.key}`} style={{ marginBottom: 6, fontSize: 13 }}>
            <div><strong>{s.name}</strong></div>
            {s.provisions_read && <div>Read: {s.provisions_read}</div>}
            {s.version_and_date_read && <div>Version and date: {s.version_and_date_read}</div>}
            {s.status && <div>Status: {s.status}</div>}
            {s.notes && <div style={{ color: 'var(--text3)' }}>{s.notes}</div>}
            <div>
              {link
                ? <a href={link} target="_blank" rel="noopener noreferrer">Open the official page</a>
                : <span style={{ color: 'var(--text3)' }}>Official link to be added</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
