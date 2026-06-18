// Display order for the derived rooftop-type buckets.
export const TYPE_ORDER = [
  'Franchise Group',
  'Franchise Individual',
  'Independent Group',
  'Independent Individual',
  'Others',
]

export function groupBy(rows, keyFn) {
  const m = new Map()
  for (const r of rows) {
    const k = keyFn(r)
    if (!m.has(k)) m.set(k, [])
    m.get(k).push(r)
  }
  return m
}

// Shared rollup used by By Type / By CSM / By Month.
function rollup(key, rows) {
  const enterprises = new Set()
  let app = 0
  let sv = 0
  let svl = 0
  let sc = 0
  let active = 0
  let arr = 0
  for (const r of rows) {
    enterprises.add(r.enterpriseId)
    if (r.app) app++
    if (r.smartview) sv++
    if (r.smartviewVlp) svl++
    if (r.smartCampaign) sc++
    if (r.active) active++
    arr += r.arr
  }
  return {
    key,
    rooftops: rows.length,
    enterprises: enterprises.size,
    app,
    sv,
    svl,
    sc,
    active,
    arr,
    // App adoption is measured against active rooftops; the rest stay vs total.
    appPct: active ? app / active : 0,
    svPct: rows.length ? sv / rows.length : 0,
    svlPct: rows.length ? svl / rows.length : 0,
    scPct: rows.length ? sc / rows.length : 0,
  }
}

// Funnel order for lifecycle stages. Substring match so label variants (e.g.
// "In Onboarding") still rank correctly; unknown stages sort last.
export const STAGE_ORDER = ['contracted', 'onboarding', 'live', 'churned']

export function stageRank(stage) {
  const s = (stage || '').toLowerCase()
  const i = STAGE_ORDER.findIndex((k) => s.includes(k))
  return i === -1 ? STAGE_ORDER.length : i
}

// Studio Health Report lifecycle funnel (cumulative top-of-funnel view). Rows:
//   Contracted — every rooftop that has been contracted (Contracted + Onboarding + Live)
//   PWS        — rooftops still in the Contracted stage
//   Onboarding — rooftops in the Onboarding stage
//   Live       — rooftops in the Live stage
// Churned rooftops are excluded; there is no Total row. Accounts = distinct enterprise_id,
// Rooftops = distinct team_id, Active = distinct active team_id, Arr = sum of contracted_arr,
// each computed distinctly within the row's stage set (cumulative rows are not naive sums).
const FUNNEL_ROWS = [
  { stage: 'Contracted', match: ['contracted', 'onboarding', 'live'] },
  { stage: 'PWS', match: ['contracted'] },
  { stage: 'Onboarding', match: ['onboarding'] },
  { stage: 'Live', match: ['live'] },
]

export function lifecycleFunnel(rows) {
  return FUNNEL_ROWS.map(({ stage, match }) => {
    const accounts = new Set()
    const rooftops = new Set()
    const active = new Set()
    let arr = 0
    for (const r of rows) {
      const s = (r.stage || '').toLowerCase()
      if (!match.some((m) => s.includes(m))) continue
      accounts.add(r.enterpriseId)
      rooftops.add(r.teamId)
      if (r.active) active.add(r.teamId)
      arr += r.arr
    }
    return { stage, accounts: accounts.size, rooftops: rooftops.size, active: active.size, arr }
  })
}

export function computeKpis(rows) {
  let app = 0
  let sv = 0
  let svl = 0
  let sc = 0
  let active = 0
  let live = 0
  let arr = 0
  for (const r of rows) {
    if (r.app) app++
    if (r.smartview) sv++
    if (r.smartviewVlp) svl++
    if (r.smartCampaign) sc++
    if (r.active) active++
    if (r.stage && r.stage.toLowerCase() === 'live') live++
    arr += r.arr
  }
  return { total: rows.length, app, sv, svl, sc, active, live, arr }
}

export function byRooftopType(rows) {
  const out = [...groupBy(rows, (r) => r.rooftopType).entries()].map(([k, rs]) => rollup(k, rs))
  out.sort((a, b) => TYPE_ORDER.indexOf(a.key) - TYPE_ORDER.indexOf(b.key))
  return out
}

// Display order for the customer-segment buckets.
export const SEGMENT_ORDER = ['Ent', 'Mid', 'SMB', 'Resellers', 'Unspecified']

export function byCustomerSegment(rows) {
  const out = [...groupBy(rows, (r) => r.customerSegment).entries()].map(([k, rs]) => rollup(k, rs))
  out.sort((a, b) => {
    const ai = SEGMENT_ORDER.indexOf(a.key)
    const bi = SEGMENT_ORDER.indexOf(b.key)
    return (ai === -1 ? SEGMENT_ORDER.length : ai) - (bi === -1 ? SEGMENT_ORDER.length : bi)
  })
  return out
}

export function byCSM(rows) {
  const out = [...groupBy(rows, (r) => r.csm).entries()].map(([k, rs]) => rollup(k, rs))
  out.sort((a, b) => b.rooftops - a.rooftops)
  return out
}

// Bucket a raw plan value into the three studio tiers. Anything that isn't
// clearly Lite or Pro falls to Others (incl. blank/Enterprise/etc.).
export function classifyPlan(plan) {
  const p = (plan ?? '').toString().toLowerCase()
  if (p.includes('lite')) return 'Studio - Lite'
  if (p.includes('pro')) return 'Studio - Pro'
  return 'Studio - Others'
}

// Rooftop counts per studio plan tier, for the Studio Health Report KPIs.
export function planCounts(rows) {
  let lite = 0
  let pro = 0
  let others = 0
  let liteArr = 0
  let proArr = 0
  let othersArr = 0
  for (const r of rows) {
    const tier = classifyPlan(r.plan)
    if (tier === 'Studio - Lite') {
      lite++
      liteArr += r.arr
    } else if (tier === 'Studio - Pro') {
      pro++
      proArr += r.arr
    } else {
      others++
      othersArr += r.arr
    }
  }
  return { lite, pro, others, total: rows.length, liteArr, proArr, othersArr }
}

const pad2 = (n) => String(n).padStart(2, '0')

// Key for the Monday (UTC) that starts the week containing the given YYYY-MM-DD.
function weekKey(ymd) {
  const [y, m, d] = ymd.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  const day = dt.getUTCDay() // 0=Sun … 6=Sat
  dt.setUTCDate(dt.getUTCDate() + (day === 0 ? -6 : 1 - day))
  return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`
}

// Group go-lives by 'month' or 'week' on the UTC calendar date; newest period first.
export function byPeriod(rows, period) {
  const keyFn = period === 'week' ? (r) => weekKey(r.liveYMD) : (r) => r.liveYMD.slice(0, 7)
  const out = [...groupBy(rows.filter((r) => r.liveYMD), keyFn).entries()].map(([k, rs]) =>
    rollup(k, rs),
  )
  out.sort((a, b) => b.key.localeCompare(a.key))
  return out
}

export function byEnterprise(rows) {
  return [...groupBy(rows, (r) => r.enterpriseId).entries()].map(([id, rs]) => {
    let app = 0
    let sv = 0
    let svl = 0
    let sc = 0
    let active = 0
    let live = 0
    let onboarding = 0
    let arr = 0
    const csmCount = {}
    const obCount = {}
    const typeCount = {}
    const segmentCount = {}
    for (const r of rs) {
      if (r.app) app++
      if (r.smartview) sv++
      if (r.smartviewVlp) svl++
      if (r.smartCampaign) sc++
      if (r.active) active++
      const stage = r.stage.toLowerCase()
      if (stage === 'live') live++
      else if (stage === 'onboarding') onboarding++
      arr += r.arr
      csmCount[r.csm] = (csmCount[r.csm] || 0) + 1
      obCount[r.obPoc] = (obCount[r.obPoc] || 0) + 1
      const tt = r.teamType || 'NA'
      typeCount[tt] = (typeCount[tt] || 0) + 1
      const seg = r.customerSegment || 'Unspecified'
      segmentCount[seg] = (segmentCount[seg] || 0) + 1
    }
    const csm = Object.entries(csmCount).sort((a, b) => b[1] - a[1])[0][0]
    // OB POC is per-rooftop; surface the most common one for the enterprise.
    const obPoc = Object.entries(obCount).sort((a, b) => b[1] - a[1])[0][0]
    // An enterprise's team_type is normally uniform; if mixed, take the most common.
    const teamType = Object.entries(typeCount).sort((a, b) => b[1] - a[1])[0][0]
    // Same for customer_segment — uniform per enterprise; take the most common if mixed.
    const customerSegment = Object.entries(segmentCount).sort((a, b) => b[1] - a[1])[0][0]
    return {
      enterpriseId: id,
      enterpriseName: rs[0].enterpriseName,
      teamType,
      customerSegment,
      rooftops: rs.length,
      live,
      onboarding,
      app,
      sv,
      svl,
      sc,
      active,
      // App adoption is measured against active rooftops; the rest stay vs total.
      appPct: active ? app / active : 0,
      svPct: rs.length ? sv / rs.length : 0,
      svlPct: rs.length ? svl / rs.length : 0,
      scPct: rs.length ? sc / rs.length : 0,
      csm,
      obPoc,
      arr,
    }
  })
}
