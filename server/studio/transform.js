// Normalize raw CSV rows (one per rooftop) into typed objects with derived fields.

const norm = (v) => (v ?? '').toString().trim()
const isYes = (v) => norm(v).toLowerCase() === 'yes'

// Stages that count as an operational rooftop. The source sheet also carries
// "Contracted" (and may carry "Churned" etc.). The dashboard and the daily adoption
// report operate on the Live/Onboarding subset; the Studio Health Report's funnel
// section needs the full set (see normalizeRows vs transformRows below).
export const OPERATIONAL_STAGES = ['live', 'onboarding']

export function operationalRooftops(rows) {
  return rows.filter((r) => OPERATIONAL_STAGES.includes((r.stage || '').toLowerCase()))
}

// Live rooftops only. The Studio Health Report's Plan section counts plan tiers
// across Live teams (a subset of operational).
export function liveRooftops(rows) {
  return rows.filter((r) => (r.stage || '').toLowerCase().includes('live'))
}

// Derived "Rooftop Type" — Franchise/Independent (team_sub_type) crossed with
// Group/Individual (team_type). Mirrors the source SQL CASE exactly: anything
// not matching the four dealer combinations (incl. blank type) falls to Others.
export function deriveRooftopType(teamType, subType) {
  const t = norm(teamType).toUpperCase()
  const s = norm(subType).toUpperCase()
  if (t === 'GROUP_DEALER' && s === 'INDEPENDENT_DEALER') return 'Independent Group'
  if (t === 'GROUP_DEALER' && s === 'FRANCHISE_DEALER') return 'Franchise Group'
  if (t === 'INDIVIDUAL_DEALER' && s === 'INDEPENDENT_DEALER') return 'Independent Individual'
  if (t === 'INDIVIDUAL_DEALER' && s === 'FRANCHISE_DEALER') return 'Franchise Individual'
  return 'Others'
}

// The source occasionally ships ids with or without the `lt.` prefix.
const teamIdOf = (r) => norm(r['lt.team_id'] ?? r['team_id'])
const enterpriseIdOf = (r) => norm(r['lt.enterprise_id'] ?? r['enterprise_id'])

// Pure normalization of raw CSV rows → typed objects, keeping ALL stages
// (incl. Contracted/Churned). The Studio Health Report funnel reads this directly.
export function normalizeRows(rawRows) {
  return rawRows
    .filter((r) => teamIdOf(r) !== '')
    .map((r) => {
      const teamType = norm(r.team_type)
      const subType = norm(r.team_sub_type)
      const liveRaw = norm(r.live_date)
      const parsed = liveRaw ? new Date(liveRaw) : null
      const liveDate = parsed && !isNaN(parsed.getTime()) ? parsed : null
      // Bucket/display by the UTC calendar date (matches the source & the sheet),
      // not the viewer's local timezone — otherwise late-UTC timestamps drift months.
      const liveYMD = liveDate
        ? `${liveDate.getUTCFullYear()}-${String(liveDate.getUTCMonth() + 1).padStart(2, '0')}-${String(liveDate.getUTCDate()).padStart(2, '0')}`
        : null
      return {
        teamId: teamIdOf(r),
        enterpriseId: enterpriseIdOf(r),
        teamName: norm(r.team_name) || '—',
        enterpriseName: norm(r.enterprise_name) || '—',
        stage: norm(r.stage) || '—',
        csm: norm(r.cs_poc) || 'Unassigned',
        obPoc: norm(r.ob_poc) || '—',
        arr: parseFloat(norm(r.contracted_arr)) || 0,
        teamType,
        subType,
        rooftopType: deriveRooftopType(teamType, subType),
        customerSegment: norm(r.customer_segment) || 'Unspecified',
        // Raw pricing plan from the sheet (e.g. "Studio - Lite"); bucketed in aggregations.
        plan: norm(r.plan ?? r.Plan),
        app: isYes(r.app_adoption),
        // Support either the current header (Smartview_vdp_enabled) or a rename.
        smartview: isYes(r.Smartview_vdp_enabled ?? r.Smartview_vdp ?? r.smartview_vdp),
        smartviewVlp: isYes(r.Smartview_vlp_enabled),
        smartCampaign: isYes(r.smart_campaign_adoption),
        // Active = processed an image in the last 30 days.
        active: isYes(r.Active ?? r.active),
        liveDate,
        liveYMD,
        liveMonth: liveYMD ? liveYMD.slice(0, 7) : null,
      }
    })
}

// Operational rooftops only (Live/Onboarding) — what the dashboard and the daily
// adoption report consume. Behaviour is unchanged for those callers.
export function transformRows(rawRows) {
  return operationalRooftops(normalizeRows(rawRows))
}
