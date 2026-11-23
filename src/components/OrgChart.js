// OrgChart.js — Marae organisational structure chart
// Reads from marae_settings: marae_name, entities, sub_committees
// Reads trustees from profiles
// Renders as SVG — no external library needed

import React, { useRef, useState } from 'react';

const TEAL     = 'var(--brand, #1a4a3a)';
const TEAL_HEX = '#1a4a3a';
const COLS = {
  marae:    { fill: '#1a4a3a', text: '#fff',    stroke: '#0f2e22' },
  entity:   { fill: '#2d6a52', text: '#fff',    stroke: '#1a4a3a' },
  trustee:  { fill: '#e8f4ef', text: '#1a4a3a', stroke: '#1a4a3a' },
  chair:    { fill: '#1a4a3a', text: '#fff',    stroke: '#0f2e22' },
  subcom:   { fill: '#f0ecf8', text: '#6b42a8', stroke: '#6b42a8' },
  invest:   { fill: '#fdf0dc', text: '#7a4f00', stroke: '#d4860a' },
};

const BOX_W = 160;
const BOX_H = 52;
const PAD   = 20;
const GAP_X = 24;
const GAP_Y = 60;

function wrap(text, maxChars = 20) {
  if (!text) return [''];
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    if ((line + ' ' + w).trim().length > maxChars) {
      if (line) lines.push(line);
      line = w;
    } else {
      line = (line + ' ' + w).trim();
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 3);
}

function Box({ x, y, label, sublabel, style, onClick, highlighted }) {
  const lines = wrap(label, 18);
  const h = BOX_H + (lines.length > 1 ? (lines.length - 1) * 14 : 0);
  return (
    <g onClick={onClick} style={{ cursor: onClick ? 'pointer' : 'default' }}>
      <rect
        x={x} y={y} width={BOX_W} height={h} rx={8}
        fill={style.fill} stroke={style.stroke} strokeWidth={highlighted ? 3 : 1.5}
        style={{ filter: highlighted ? 'drop-shadow(0 2px 6px rgba(0,0,0,0.18))' : 'none' }}
      />
      {lines.map((l, i) => (
        <text key={i} x={x + BOX_W / 2} y={y + 20 + i * 14}
          textAnchor="middle" fill={style.text}
          fontSize={i === 0 ? 11 : 10} fontWeight={i === 0 ? 700 : 400}
          fontFamily="system-ui, sans-serif">
          {l}
        </text>
      ))}
      {sublabel && (
        <text x={x + BOX_W / 2} y={y + h - 10}
          textAnchor="middle" fill={style.text} fontSize={9} opacity={0.75}
          fontFamily="system-ui, sans-serif">
          {sublabel}
        </text>
      )}
    </g>
  );
}

function Line({ x1, y1, x2, y2 }) {
  return <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#b0c8bc" strokeWidth={1.5} strokeDasharray="4 2" />;
}

function ElbowDown({ fromX, fromY, fromH, toX, toY }) {
  const midY = fromY + fromH + GAP_Y / 2;
  return (
    <path
      d={`M${fromX},${fromY + fromH} L${fromX},${midY} L${toX},${midY} L${toX},${toY}`}
      fill="none" stroke="#b0c8bc" strokeWidth={1.5}
    />
  );
}

export default function OrgChart({ maraeName, entities, subCommittees, trustees }) {
  const [hovered, setHovered] = useState(null);

  // ── Layout ──────────────────────────────────────────────────────────────
  // Row 0: Marae name (centred)
  // Row 1: Entities (spread across)
  // Row 2: Chairman box (centred under marae)
  // Row 3: Trustees (spread)
  // Row 4: Sub-committees (spread)

  const chairman = trustees.find(t =>
    t.title?.toLowerCase().includes('chair') || t.title?.toLowerCase().includes('chairman')
  );
  const otherTrustees = trustees.filter(t => t !== chairman);
  const allTrustees = chairman ? [chairman, ...otherTrustees] : trustees;

  // Calculate widths
  const entCount  = Math.max(entities.length, 1);
  const tCount    = Math.max(allTrustees.length, 1);
  const scCount   = Math.max(subCommittees.length, 1);

  const entRowW   = entCount  * BOX_W + (entCount  - 1) * GAP_X;
  const tRowW     = tCount    * BOX_W + (tCount    - 1) * GAP_X;
  const scRowW    = scCount   * BOX_W + (scCount   - 1) * GAP_X;

  const totalW    = Math.max(entRowW, tRowW, scRowW, BOX_W) + PAD * 2;
  const cx        = totalW / 2;

  // Row Y positions
  const y0 = PAD;                                      // Marae name
  const y1 = y0 + BOX_H + GAP_Y;                      // Entities
  const y2 = y1 + BOX_H + GAP_Y;                      // Chairman
  const y3 = y2 + BOX_H + GAP_Y;                      // All trustees
  const y4 = y3 + BOX_H + GAP_Y;                      // Sub-committees
  const totalH = (subCommittees.length > 0 ? y4 + BOX_H : y3 + BOX_H) + PAD;

  // X positions for each row (centred)
  function rowXs(count, rowW) {
    const startX = cx - rowW / 2;
    return Array.from({ length: count }, (_, i) => startX + i * (BOX_W + GAP_X));
  }

  const entXs = rowXs(entCount, entRowW);
  const tXs   = rowXs(tCount,   tRowW);
  const scXs  = rowXs(scCount,  scRowW);
  const maraeX = cx - BOX_W / 2;

  return (
    <div style={{ overflowX: 'auto', width: '100%' }}>
      <svg
        width={totalW}
        height={totalH}
        viewBox={`0 0 ${totalW} ${totalH}`}
        style={{ display: 'block', margin: '0 auto', maxWidth: '100%' }}
      >
        {/* Marae → Entities lines */}
        {entities.map((_, i) => (
          <ElbowDown key={i}
            fromX={maraeX + BOX_W / 2} fromY={y0} fromH={BOX_H}
            toX={entXs[i] + BOX_W / 2} toY={y1}
          />
        ))}

        {/* Marae → Chairman line */}
        <line x1={maraeX + BOX_W / 2} y1={y0 + BOX_H} x2={cx} y2={y2} stroke="#b0c8bc" strokeWidth={1.5} />

        {/* Chairman → Trustees lines */}
        {allTrustees.map((_, i) => (
          <ElbowDown key={i}
            fromX={cx} fromY={y2} fromH={BOX_H}
            toX={tXs[i] + BOX_W / 2} toY={y3}
          />
        ))}

        {/* Trustees → Sub-committees lines */}
        {subCommittees.map((_, i) => (
          <line key={i}
            x1={cx} y1={y3 + BOX_H}
            x2={scXs[i] + BOX_W / 2} y2={y4}
            stroke="#b0c8bc" strokeWidth={1.5} strokeDasharray="4 2"
          />
        ))}

        {/* ── Boxes ── */}

        {/* Marae */}
        <Box x={maraeX} y={y0} label={maraeName || 'Our Marae'} style={COLS.marae} highlighted={hovered === 'marae'}
          onClick={() => setHovered(h => h === 'marae' ? null : 'marae')} />

        {/* Entities */}
        {entities.length === 0 && (
          <Box x={maraeX} y={y1} label="Add entities in Settings" style={{ fill: '#f5f5f5', text: '#aaa', stroke: '#ddd' }} />
        )}
        {entities.map((ent, i) => (
          <Box key={i} x={entXs[i]} y={y1}
            label={ent.name || 'Entity'}
            sublabel={ent.reg_number ? `Reg: ${ent.reg_number}` : undefined}
            style={COLS.entity}
            highlighted={hovered === `ent${i}`}
            onClick={() => setHovered(h => h === `ent${i}` ? null : `ent${i}`)}
          />
        ))}

        {/* Chairman */}
        <Box x={cx - BOX_W / 2} y={y2}
          label={chairman ? chairman.full_name : 'Chairman'}
          sublabel={chairman?.title || 'Chairman'}
          style={COLS.chair}
          highlighted={hovered === 'chair'}
          onClick={() => setHovered(h => h === 'chair' ? null : 'chair')}
        />

        {/* Trustees */}
        {allTrustees.length === 0 && (
          <Box x={maraeX} y={y3} label="No trustees yet" style={{ fill: '#f5f5f5', text: '#aaa', stroke: '#ddd' }} />
        )}
        {allTrustees.map((t, i) => (
          <Box key={i} x={tXs[i]} y={y3}
            label={t.full_name || '—'}
            sublabel={t.title || 'Trustee'}
            style={t === chairman ? COLS.chair : COLS.trustee}
            highlighted={hovered === `t${i}`}
            onClick={() => setHovered(h => h === `t${i}` ? null : `t${i}`)}
          />
        ))}

        {/* Sub-committees */}
        {subCommittees.map((sc, i) => (
          <Box key={i} x={scXs[i]} y={y4}
            label={sc.name || 'Sub-committee'}
            sublabel={sc.lead ? `Lead: ${sc.lead}` : undefined}
            style={COLS.subcom}
            highlighted={hovered === `sc${i}`}
            onClick={() => setHovered(h => h === `sc${i}` ? null : `sc${i}`)}
          />
        ))}
      </svg>

      <div style={{ textAlign: 'center', marginTop: 8, fontSize: 11, color: 'var(--text3)' }}>
        Click any box for details · Configure in Settings → Marae Profile
      </div>
    </div>
  );
}
