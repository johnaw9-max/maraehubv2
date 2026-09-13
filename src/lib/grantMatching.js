// Step 4/5 of the Future Integrations plan (ClickUp 14yhc7kpjbd) -- simple,
// deterministic keyword/category matching between a grant and a marae's real
// Goals, not AI reasoning (per the plan's own scope). Scoring tiers, in
// descending trust order: an explicit trustee self-tag (goal.related_module
// === 'Grants') outweighs a real category match, which outweighs a manually
// curated category synonym, which outweighs incidental shared keywords --
// each tier capped/weighted so a lower tier can never outrank a higher one.

const CATEGORY_SYNONYMS = {
  'Infrastructure': 'Facilities',
  'Health': 'Health & Wellbeing',
  'Environment': 'Taonga preservation',
  'Cultural': 'Taonga preservation',
  'Sport & Recreation': 'Rangatahi',
  'Education': 'Rangatahi',
};

// 'General' is goals.focus_area's unset default (all 3 real Tineka goals
// have it) -- not a real category, so it must never score. Letting it score
// would give every under-categorised goal a phantom match on every grant.
const NON_SCORING_FOCUS_AREA = 'General';

const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'on', 'for', 'with', 'at',
  'by', 'from', 'is', 'are', 'was', 'be', 'this', 'that', 'it', 'as',
]);

// Words that trivially co-occur across almost every real grant/goal record
// in this domain and would otherwise masquerade as relevance.
const DOMAIN_STOPWORDS = new Set([
  'marae', 'grant', 'fund', 'funding', 'development', 'programme', 'project',
  'initiative',
]);

const KEYWORD_POINTS_PER_TOKEN = 10;
const KEYWORD_POINTS_CAP = 30;

function tokenize(text) {
  return (text || '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(t => t.length >= 3 && !STOPWORDS.has(t) && !DOMAIN_STOPWORDS.has(t));
}

function sharedKeywords(grant, goal) {
  const grantTokens = new Set(tokenize(`${grant.name || ''} ${grant.notes || ''}`));
  const goalTokens = tokenize(`${goal.name || ''} ${goal.description || ''}`);
  const shared = [...new Set(goalTokens)].filter(t => grantTokens.has(t));
  return shared;
}

function scoreGoal(grant, goal) {
  let score = 0;
  const reasons = [];

  if (goal.related_module === 'Grants') {
    score += 100;
    reasons.push('Already tagged as grant-seeking');
  }

  if (grant.category && goal.focus_area && goal.focus_area !== NON_SCORING_FOCUS_AREA) {
    if (grant.category === goal.focus_area) {
      score += 50;
      reasons.push(`Category match: ${goal.focus_area}`);
    } else if (CATEGORY_SYNONYMS[grant.category] === goal.focus_area) {
      score += 25;
      reasons.push(`Related category: ${grant.category} ↔ ${goal.focus_area}`);
    }
  }

  const shared = sharedKeywords(grant, goal);
  if (shared.length > 0) {
    score += Math.min(shared.length * KEYWORD_POINTS_PER_TOKEN, KEYWORD_POINTS_CAP);
    reasons.push(`Shared keywords: ${shared.join(', ')}`);
  }

  return { score, reasons };
}

/**
 * Ranks a marae's real Goals against one grant. Pure, synchronous, no I/O --
 * excludes completed goals, returns only goals with score > 0, ties broken
 * by target_date ascending (nulls last), same urgency-first convention as
 * TaskBoard.js.
 */
export function matchGrantToGoals(grant, goals, limit = 3) {
  if (!grant || !Array.isArray(goals)) return [];

  return goals
    .filter(g => g.status !== 'completed')
    .map(goal => ({ goal, ...scoreGoal(grant, goal) }))
    .filter(m => m.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (!a.goal.target_date) return 1;
      if (!b.goal.target_date) return -1;
      return new Date(a.goal.target_date) - new Date(b.goal.target_date);
    })
    .slice(0, limit);
}
