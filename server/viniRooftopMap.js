/**
 * Maps a Metabase JSON row (mixed types) to the Rooftop shape expected by
 * src/vini/lib/ragLogic.ts scoreRooftop(). Mirrors parseCSVRow column names.
 */

const EXCLUDE_NAMES = new Set([
  "spyne motors", "spyne", "prompt testing", "team 1",
  "onboardtest3", "onboardtest4", "khandelwal", "speed to lead",
  "approval genie", "spyne auto group",
]);

function pick(row, ...keys) {
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== null && row[k] !== "") return row[k];
  }
  return undefined;
}

function toStr(v) {
  if (v == null) return "";
  return String(v).trim();
}

function toNum(v) {
  if (v === "" || v === null || v === undefined) return null;
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  const cleaned = String(v).trim().replace(/,/g, "").replace(/%$/, "");
  const num = parseFloat(cleaned);
  return Number.isNaN(num) ? null : num;
}

function toPctDecimal(v) {
  const n = toNum(v);
  if (n === null) return null;
  // If value looks like 7.78 (percentage) vs 0.0778
  if (n > 1 && n <= 100) return n / 100;
  return n;
}

/** @returns {object | null} Rooftop-shaped row for scoreRooftop() */
export function metabaseRowToRooftop(row) {
  if (!row || typeof row !== "object") return null;

  const name = toStr(pick(row, "rooftop_name", "Rooftop Name", "rooftopName"));
  const enterprise = toStr(pick(row, "enterprise_name", "Enterprise Name", "enterpriseName"));
  if (!name || EXCLUDE_NAMES.has(name.toLowerCase())) return null;

  const agentType =
    toStr(pick(row, "Agent Type", "agent_type", "agentType")) || "Unknown";

  const teamIdRaw = pick(row, "team_id", "teamId", "Team Id");
  const teamId = teamIdRaw != null && String(teamIdRaw).trim() !== ""
    ? String(teamIdRaw).trim()
    : null;

  return {
    teamId,
    enterpriseName: enterprise,
    rooftopName: name,
    agentType,
    totalLeads: toNum(pick(row, "total_leads", "totalLeads")) ?? 0,
    viniInteractions: toNum(pick(row, "total_leads_interacted_with_vini", "totalLeadsInteractedWithVini")) ?? 0,
    callLeads: toNum(pick(row, "total_leads_with_calls", "totalLeadsWithCalls")) ?? 0,
    smsLeads: toNum(pick(row, "total_leads_with_sms", "totalLeadsWithSms")) ?? 0,
    appointments: toNum(pick(row, "total_appointments", "totalAppointments")) ?? 0,
    apptRate: toPctDecimal(pick(row, "appointment_booking_rate", "appointmentBookingRate")),
    avgScore: toNum(pick(row, "avg_score_percentage", "avgScorePercentage")),
  };
}

export function mapMetabaseRows(rows) {
  if (!Array.isArray(rows)) return [];
  const out = [];
  for (const row of rows) {
    const r = metabaseRowToRooftop(row);
    if (r) out.push(r);
  }
  return out;
}
