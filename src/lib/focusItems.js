// "Focus this week" card — Step 2 (ClickUp 86d3vc4yp).
// Pure data-gathering: takes the 4 signal sources already computed in
// BoardDashboard.js, applies the Step 1 ranking rules (locked 2026-08-04),
// and returns up to 3 ranked items. No React, no queries, no new tables.

const SOURCE_PRIORITY = { risk: 0, meeting_action: 1, service_reminder: 2, finance: 3 };

function riskCandidate(highOpenRisks, today, truncate) {
  if (highOpenRisks.length === 0) return null;

  const scored = highOpenRisks.map(r => {
    if (!r.review_date) return { risk: r, urgent: true, days: null };
    const reviewDate = new Date(r.review_date + 'T12:00:00');
    const overdue = reviewDate < today;
    return { risk: r, urgent: overdue, days: overdue ? Math.floor((today - reviewDate) / 86400000) : null };
  });

  const worst = scored.reduce((worst, cur) => {
    if (!worst) return cur;
    if (cur.urgent !== worst.urgent) return cur.urgent ? cur : worst;
    if (cur.urgent && worst.urgent) {
      if (cur.days === null || worst.days === null) return cur.days === null ? cur : worst;
      return cur.days > worst.days ? cur : worst;
    }
    return worst;
  }, null);

  const detail = worst.days !== null
    ? `review overdue by ${worst.days} day${worst.days !== 1 ? 's' : ''}`
    : worst.risk.review_date ? 'review scheduled, not yet due' : 'no review ever scheduled';

  return {
    source: 'risk',
    tier: worst.urgent ? 'urgent' : 'worth-a-look',
    text: `Review high-rated risk: '${truncate(worst.risk.risk_description)}' — ${detail}`,
    owner: worst.risk.owner || null,
    navTo: 'risks',
  };
}

function actionCandidate(overdueActions, today, truncate) {
  if (overdueActions.length === 0) return null;

  const worst = overdueActions.reduce((worst, a) => {
    const days = Math.floor((today - new Date(a.due_date + 'T12:00:00')) / 86400000);
    return (!worst || days > worst.days) ? { action: a, days } : worst;
  }, null);

  return {
    source: 'meeting_action',
    tier: worst.days > 7 ? 'urgent' : 'worth-a-look',
    text: `Follow up on '${truncate(worst.action.description)}' — ${worst.days} day${worst.days !== 1 ? 's' : ''} overdue`,
    owner: worst.action.assigned_to || null,
    navTo: 'minutes',
  };
}

function reminderCandidate(overdueReminders, assets, today) {
  if (overdueReminders.length === 0) return null;

  const assetById = Object.fromEntries(assets.map(a => [a.id, a]));
  const worst = overdueReminders.reduce((worst, r) => {
    const days = Math.floor((today - new Date(r.due_date + 'T12:00:00')) / 86400000);
    return (!worst || days > worst.days) ? { reminder: r, days } : worst;
  }, null);

  const assetName = assetById[worst.reminder.asset_id]?.name || 'an asset';

  return {
    source: 'service_reminder',
    tier: worst.days > 7 ? 'urgent' : 'worth-a-look',
    text: `Arrange service for ${assetName} — ${worst.days} day${worst.days !== 1 ? 's' : ''} overdue`,
    owner: worst.reminder.owner || null,
    navTo: 'assets',
  };
}

function financeCandidate(finNet, fmtMoney) {
  if (finNet >= 0) return null;

  return {
    source: 'finance',
    tier: 'worth-a-look', // locked — finance never escalates to urgent, see Step 1
    text: `Review Finance — running a ${fmtMoney(Math.abs(finNet))} deficit this year`,
    owner: null,
    navTo: 'finance',
  };
}

export function buildFocusItems({ overdueActions, overdueReminders, finNet, highOpenRisks, assets, today, truncate, fmtMoney }) {
  const candidates = [
    riskCandidate(highOpenRisks, today, truncate),
    actionCandidate(overdueActions, today, truncate),
    reminderCandidate(overdueReminders, assets, today),
    financeCandidate(finNet, fmtMoney),
  ].filter(Boolean);

  candidates.sort((a, b) => {
    if (a.tier !== b.tier) return a.tier === 'urgent' ? -1 : 1;
    return SOURCE_PRIORITY[a.source] - SOURCE_PRIORITY[b.source];
  });

  // Stage 4 (86d41pc93): total preserved alongside the cap so the card can
  // show "+N more" instead of silently dropping items. Can only ever be
  // capped-vs-total 4-vs-3 at most, since there's one candidate per source.
  // `all` added later so the card can genuinely expand into the hidden
  // item(s) instead of "+N more" being a dead end -- purely additive,
  // items/total unchanged.
  return { items: candidates.slice(0, 3), total: candidates.length, all: candidates };
}
