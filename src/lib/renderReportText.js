import React from 'react';

// Lightweight markdown rendering for AI-generated report text (**bold** spans
// and -/*/• bullet lines) -- the AI writes markdown by default but modals
// were displaying it as a raw pre-wrap string, showing literal ** and -.
// Extracted from BoardDashboard.js (Reports #1-4) so generate-grant-draft's
// UI (14yhc7kpjbd, Step 7) can reuse it instead of duplicating it.
export function renderReportText(text) {
  if (!text) return null;
  const blocks = [];
  let listItems = null;

  const renderInline = (str, key) =>
    str.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((part, i) =>
      part.startsWith('**') && part.endsWith('**')
        ? <strong key={`${key}-${i}`}>{part.slice(2, -2)}</strong>
        : <React.Fragment key={`${key}-${i}`}>{part}</React.Fragment>
    );

  text.split('\n').forEach((line, idx) => {
    const trimmed = line.trim();
    const bulletMatch = trimmed.match(/^[-*•]\s+(.*)/);
    if (bulletMatch) {
      (listItems ??= []).push(<li key={idx} style={{ marginBottom: 4 }}>{renderInline(bulletMatch[1], idx)}</li>);
      return;
    }
    if (listItems) { blocks.push(<ul key={`ul-${idx}`} style={{ margin: '4px 0 12px', paddingLeft: 20 }}>{listItems}</ul>); listItems = null; }
    if (trimmed === '') { blocks.push(<div key={idx} style={{ height: 8 }} />); return; }
    const headingMatch = trimmed.match(/^\*\*(.+)\*\*:?$/);
    if (headingMatch) { blocks.push(<div key={idx} style={{ fontWeight: 700, marginTop: 14, marginBottom: 4 }}>{headingMatch[1]}</div>); return; }
    blocks.push(<div key={idx}>{renderInline(line, idx)}</div>);
  });
  if (listItems) blocks.push(<ul key="ul-end" style={{ margin: '4px 0 12px', paddingLeft: 20 }}>{listItems}</ul>);
  return blocks;
}
