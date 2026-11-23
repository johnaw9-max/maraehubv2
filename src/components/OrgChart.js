// OrgChart.js — Marae organisational structure chart
// Renders from whatever data exists — no phantom rows when arrays are empty

import React, { useState } from 'react';

const COLS = {
  marae:   { fill: '#1a4a3a', text: '#fff', stroke: '#0f2e22' },
  entity:  { fill: '#2d6a52', text: '#fff', stroke: '#1a4a3a' },
  chair:   { fill: '#1a4a3a', text: '#fff', stroke: '#0f2e22' },
  trustee: { fill: '#e8f4ef', text: '#1a4a3a', stroke: '#1a4a3a' },
  subcom:  { fill: '#f0ecf8', text: '#6b42a8', stroke: '#6b42a8' },
};

const BOX_W = 160;
const BOX_H = 56;
const GAP_X = 20;
const ROW_GAP = 56;
const PAD = 24;

function wrap(text = '', maxChars = 18) {
  const words = String(text).split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    const candidate = line ? `${line} ${w}` : w;
    if (candidate.length > maxChars && line) {
      lines.push(line);
      line = w;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 2);
}

function boxH(label) {
  const lines = wrap(label);
  return BOX_H + (lines.length > 1 ? 12 : 0);
}

function SvgBox({ x, y, w = BOX_W, label, sublabel, col, onClick, active }) {
  const lines = wrap(label);
  const h = BOX_H + (lines.length > 1 ? 12 : 0);
  return (
    <g onClick={onClick} style={{ cursor: onClick ? 'pointer' : 'default' }}>
      <rect x={x} y={y} width={w} height={h} rx={8}
        fill={col.fill} stroke={col.stroke}
        strokeWidth={active ? 2.5 : 1.5}
        style={{ filter: active ? 'drop-shadow(0 2px 8px rgba(0,0,0,0.2))' : 'none' }}
      />
      {lines.map((l, i) => (
        <text key={i}
          x={x + w / 2} y={y + 18 + i * 14}
          textAnchor="middle"
          fill={col.text}
          fontSize={i === 0 ? 11 : 10}
          fontWeight={i === 0 ? 700 : 400}
          fontFamily="system-ui,-apple-system,sans-serif">
          {l}
        </text>
      ))}
      {sublabel && (
        <text x={x + w / 2} y={y + h - 9}
          textAnchor="middle" fill={col.text}
          fontSize={9} opacity={0.72}
          fontFamily="system-ui,-apple-system,sans-serif">
          {sublabel}
        </text>
      )}
    </g>
  );
}

function Connector({ x1, y1, x2, y2 }) {
  if (x1 === x2) {
    return <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#b0c8bc" strokeWidth={1.5} />;
  }
  const my = (y1 + y2) / 2;
  return (
    <path d={`M${x1},${y1} L${x1},${my} L${x2},${my} L${x2},${y2}`}
      fill="none" stroke="#b0c8bc" strokeWidth={1.5} />
  );
}

function rowLayout(items, cx) {
  const n = items.length;
  if (n === 0) return [];
  const totalW = n * BOX_W + (n - 1) * GAP_X;
  const startX = cx - totalW / 2;
  return items.map((item, i) => ({ ...item, x: startX + i * (BOX_W + GAP_X) }));
}

export default function OrgChart({ maraeName, entities = [], subCommittees = [], trustees = [] }) {
  const [active, setActive] = useState(null);
  const toggle = key => setActive(a => a === key ? null : key);

  const chairman = trustees.find(t =>
    t.title?.toLowerCase().includes('chair')
  );
  const otherTrustees = trustees.filter(t => t !== chairman);
  const allTrustees = chairman ? [chairman, ...otherTrustees] : [...trustees];

  // Build rows — only include a row if it has content
  const hasEntities   = entities.length > 0;
  const hasTrustees   = allTrustees.length > 0;
  const hasSubcoms    = subCommittees.length > 0;

  // Calculate canvas width from widest row
  const widestCount = Math.max(
    1,
    hasEntities  ? entities.length  : 0,
    hasTrustees  ? allTrustees.length : 0,
    hasSubcoms   ? subCommittees.length : 0,
  );
  const minW = BOX_W + PAD * 2;
  const totalW = Math.max(minW, widestCount * BOX_W + (widestCount - 1) * GAP_X + PAD * 2);
  const cx = totalW / 2;

  // Y rows
  let y = PAD;
  const maraeY = y;
  const maraeH = boxH(maraeName || 'Our Marae');
  y += maraeH + ROW_GAP;

  const entY = hasEntities ? y : null;
  if (hasEntities) y += BOX_H + ROW_GAP;

  const trusteeY = hasTrustees ? y : null;
  if (hasTrustees) y += BOX_H + ROW_GAP;

  const subcomY = hasSubcoms ? y : null;
  if (hasSubcoms) y += BOX_H + ROW_GAP;

  const totalH = y - ROW_GAP + PAD;

  const maraeX = cx - BOX_W / 2;
  const entItems  = hasEntities  ? rowLayout(entities,       cx) : [];
  const tItems    = hasTrustees  ? rowLayout(allTrustees,    cx) : [];
  const scItems   = hasSubcoms   ? rowLayout(subCommittees,  cx) : [];

  return (
    <div style={{ overflowX: 'auto', width: '100%' }}>
      <svg width={totalW} height={totalH}
        viewBox={`0 0 ${totalW} ${totalH}`}
        style={{ display: 'block', margin: '0 auto', maxWidth: '100%' }}>

        {/* Marae → Entities */}
        {hasEntities && entItems.map((e, i) => (
          <Connector key={i}
            x1={maraeX + BOX_W / 2} y1={maraeY + maraeH}
            x2={e.x + BOX_W / 2}   y2={entY} />
        ))}

        {/* Marae → Trustees (when no entities) */}
        {!hasEntities && hasTrustees && tItems.map((t, i) => (
          <Connector key={i}
            x1={maraeX + BOX_W / 2} y1={maraeY + maraeH}
            x2={t.x + BOX_W / 2}   y2={trusteeY} />
        ))}

        {/* Entities → Trustees */}
        {hasEntities && hasTrustees && tItems.map((t, i) => (
          <Connector key={i}
            x1={cx} y1={entY + BOX_H}
            x2={t.x + BOX_W / 2} y2={trusteeY} />
        ))}

        {/* Trustees → Sub-committees */}
        {hasTrustees && hasSubcoms && scItems.map((sc, i) => (
          <Connector key={i}
            x1={cx} y1={trusteeY + BOX_H}
            x2={sc.x + BOX_W / 2} y2={subcomY} />
        ))}

        {/* ── Marae box ── */}
        <SvgBox x={maraeX} y={maraeY} label={maraeName || 'Our Marae'} col={COLS.marae}
          active={active === 'marae'} onClick={() => toggle('marae')} />

        {/* ── Entity boxes ── */}
        {entItems.map((ent, i) => (
          <SvgBox key={i} x={ent.x} y={entY}
            label={ent.name || 'Entity'}
            sublabel={ent.reg_number ? `Reg: ${ent.reg_number}` : undefined}
            col={COLS.entity}
            active={active === `ent${i}`}
            onClick={() => toggle(`ent${i}`)} />
        ))}

        {/* ── Trustee boxes ── */}
        {tItems.map((t, i) => (
          <SvgBox key={i} x={t.x} y={trusteeY}
            label={t.full_name || '—'}
            sublabel={t.title || 'Trustee'}
            col={t === chairman ? COLS.chair : COLS.trustee}
            active={active === `t${i}`}
            onClick={() => toggle(`t${i}`)} />
        ))}

        {/* ── Sub-committee boxes ── */}
        {scItems.map((sc, i) => (
          <SvgBox key={i} x={sc.x} y={subcomY}
            label={sc.name || 'Sub-committee'}
            sublabel={sc.lead ? `Lead: ${sc.lead}` : undefined}
            col={COLS.subcom}
            active={active === `sc${i}`}
            onClick={() => toggle(`sc${i}`)} />
        ))}

        {/* Empty state — marae name box only */}
        {!hasEntities && !hasTrustees && (
          <text x={cx} y={trusteeY || maraeY + maraeH + 40}
            textAnchor="middle" fill="#aaa" fontSize={13}
            fontFamily="system-ui,-apple-system,sans-serif">
            Add trustees and entities in Settings → Marae Profile
          </text>
        )}
      </svg>

      <div style={{ textAlign: 'center', marginTop: 6, fontSize: 11, color: 'var(--text3)' }}>
        Click any box · Configure in Settings → Marae Profile
      </div>
    </div>
  );
}
