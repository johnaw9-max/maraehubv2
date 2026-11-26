// Overall rating from likelihood and consequence: High if either is High,
// Low only if both are Low, otherwise Medium. One copy, used by the Risk Register
// and by the minutes reader, so both always rate a risk the same way.
export function calcRating(likelihood, consequence) {
  if (!likelihood || !consequence) return 'Low';
  if (likelihood === 'High' || consequence === 'High') return 'High';
  if (likelihood === 'Low'  && consequence === 'Low')  return 'Low';
  return 'Medium';
}
