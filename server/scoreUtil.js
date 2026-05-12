// Shared score helpers used by both internal (emailTemplate.js) and customer
// (emailTemplateDaily.js) email templates. Keep thresholds in lockstep with the
// score_buckets CTE in app.js to avoid drift.

export function scoreColor(val, nullColor = "#64748b") {
  if (val == null) return nullColor;
  if (val >= 8) return "#166534";
  if (val >= 6) return "#d97706";
  return "#cc1f1f";
}

export function formatScore(val) {
  if (val == null) return "—";
  return Number(val).toFixed(1);
}
