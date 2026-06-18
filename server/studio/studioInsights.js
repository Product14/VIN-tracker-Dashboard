// Deterministic insight facts + templated commentary for the Studio Health Report.
//
// All numbers are computed here in code (never by an LLM). The facts feed the templated
// fallback sentences; the optional GPT layer (studioHealthLLM.js) only polishes those
// sentences. Commentary leads with the DAY-ON-DAY trend (D-1 latest, vs D-2/D-3) — that's
// where the frequent movement is — with MTD kept only as a short tail.

// "91%" -> 91, "1,284" -> 1284, "6.3" -> 6.3; "—"/"NA"/"-"/"" -> null.
export function parseNum(v) {
  if (v == null) return null
  const s = String(v).replace(/,/g, '').replace(/%/g, '').trim()
  if (s === '' || s === '—' || s === '-' || /^na$/i.test(s)) return null
  const n = parseFloat(s)
  return Number.isFinite(n) ? n : null
}

// cols for the first row whose label contains `sub` (case-insensitive); {} if none.
const colsOf = (rows, sub) =>
  (rows.find((r) => r.label.toLowerCase().includes(sub)) || {}).cols || {}

// Highest P95 among the ENT/MID/SMB segments = slowest segment.
function worstP95(cols) {
  const segs = [
    ['ENT', parseNum(cols.ent)],
    ['MID', parseNum(cols.mid)],
    ['SMB', parseNum(cols.smb)],
  ].filter(([, v]) => v != null)
  if (!segs.length) return null
  const [segment, value] = segs.reduce((a, b) => (b[1] > a[1] ? b : a))
  return { segment, value }
}

// Day-on-day trend from the D-1 (latest) / D-2 / D-3 columns.
// delta3 = D-1 − D-3 (net 3-day change, whole points); dir = up/down/flat.
function trend(cols) {
  const d1 = parseNum(cols.d1)
  const d2 = parseNum(cols.d2)
  const d3 = parseNum(cols.d3)
  const delta3 = d1 != null && d3 != null ? Math.round(d1 - d3) : null
  const dir = delta3 == null ? null : delta3 > 0 ? 'up' : delta3 < 0 ? 'down' : 'flat'
  return { d1, d2, d3, delta3, dir }
}

// Per-metric display name, direction (is higher better?), and unit. Adoption feature
// rows (App, SmartView VDP, …) fall through to the default: a % where higher is better.
function metricMeta(label) {
  const l = label.toLowerCase()
  if (l.includes('pendency')) return { short: 'pendency', higher: false, unit: '' }
  if (l.includes('p95')) return { short: 'P95', higher: false, unit: ' hrs' }
  if (l.includes('media')) return { short: 'media score', higher: true, unit: '' }
  if (l.includes('12 hr')) return { short: '<12hr delivery', higher: true, unit: '%' }
  if (l.includes('6 hr')) return { short: '<6hr delivery', higher: true, unit: '%' }
  if (l.includes('delivered %') || l.includes('fulfil')) return { short: 'fulfillment', higher: true, unit: '%' }
  return { short: label, higher: true, unit: '%' }
}

// The single worst segment value vs its metric's MTD, across all metrics in a section
// (P95 excluded — the "slowest at P95" clause already covers it). Ranked by relative gap
// so different units compare fairly. Returns null if nothing is worse than its MTD.
function mostOff(rows) {
  let best = null
  for (const r of rows) {
    const meta = metricMeta(r.label)
    if (meta.short === 'P95') continue
    const mtd = parseNum(r.cols.mtd)
    if (mtd == null || mtd === 0) continue
    for (const [seg, key] of [['ENT', 'ent'], ['MID', 'mid'], ['SMB', 'smb']]) {
      const v = parseNum(r.cols[key])
      if (v == null) continue
      const adverse = meta.higher ? mtd - v : v - mtd // positive = worse than MTD
      if (adverse <= 0) continue
      const rel = adverse / Math.abs(mtd)
      if (!best || rel > best.rel) best = { seg, value: v, mtd, short: meta.short, unit: meta.unit, higher: meta.higher, rel }
    }
  }
  return best
}

/**
 * Compute per-section facts from the section row arrays the payload already holds.
 * @param {object} sections { images, three60, video, adoption } — each [{label, sub?, cols}]
 * @returns {object} { images, three60, video, adoption } facts objects
 */
export function computeInsights({ images, three60, video, adoption }) {
  const d6 = colsOf(images, '6 hr')
  const imgPend = colsOf(images, 'pendency')
  const imagesFacts = {
    section: 'images',
    sub6: { ...trend(d6), mtd: parseNum(d6.mtd) },
    pendency: { ...trend(imgPend), mtd: parseNum(imgPend.mtd) },
    worstP95: worstP95(colsOf(images, 'p95')),
    mostOff: mostOff(images),
  }

  const f3 = colsOf(three60, 'delivered %')
  const three60Facts = {
    section: '360',
    fulfillment: { ...trend(f3), mtd: parseNum(f3.mtd) },
    sub: { ...trend(colsOf(three60, '6 hr')) },
    subLabel: 'Sub-6hr delivery',
    worstP95: worstP95(colsOf(three60, 'p95')),
    mostOff: mostOff(three60),
  }

  const fv = colsOf(video, 'delivered %')
  const videoFacts = {
    section: 'video',
    fulfillment: { ...trend(fv), mtd: parseNum(fv.mtd) },
    sub: { ...trend(colsOf(video, '12 hr')) },
    subLabel: 'Sub-12hr delivery',
    worstP95: worstP95(colsOf(video, 'p95')),
    mostOff: mostOff(video),
  }

  // Adoption: leader/laggard by MTD (stable), plus the biggest day-on-day mover.
  const rows = adoption.map((r) => ({ name: r.label, mtd: parseNum(r.cols.mtd), ...trend(r.cols) }))
  const withMtd = rows.filter((r) => r.mtd != null).sort((a, b) => b.mtd - a.mtd)
  const movers = rows
    .filter((r) => r.delta3 != null && r.delta3 !== 0)
    .sort((a, b) => Math.abs(b.delta3) - Math.abs(a.delta3))
  const adoptionFacts = {
    section: 'adoption',
    leader: withMtd[0] || null,
    laggard: withMtd.length > 1 ? withMtd[withMtd.length - 1] : null,
    topMover: movers[0] || null,
    mostOff: mostOff(adoption),
  }

  return { images: imagesFacts, three60: three60Facts, video: videoFacts, adoption: adoptionFacts }
}

// ─── Templated commentary (deterministic fallback) ───────────────────────────
// Each builder returns an ARRAY of bullet points (strings). Points carry **bold**
// markers (template converts to <strong>) and lead with the daily trend. Points with
// missing data are skipped so nulls never print.

// Trailing callout for the worst segment vs its metric's MTD (no label prefix).
function mostOffClause(m) {
  if (!m) return null
  const verb = m.higher ? 'trails at' : 'spikes to'
  return `${m.seg} ${m.short} ${verb} **${m.value}${m.unit}** vs **${m.mtd}${m.unit}** MTD`
}

// e.g. ", down **8pt** over 3 days (91%→87%→83%)" — only the parts the data supports.
function trendTail(t) {
  if (t.delta3 == null) return ''
  if (t.dir === 'flat') return ', flat over 3 days'
  const series = t.d1 != null && t.d2 != null && t.d3 != null ? ` (${t.d3}%→${t.d2}%→${t.d1}%)` : ''
  return `, ${t.dir} **${Math.abs(t.delta3)}%** over 3 days${series}`
}

// A "<metric> **X%** on D-1<trend>" lead clause, or an MTD fallback if no daily data.
function dailyLead(label, m) {
  if (m.d1 != null) return `${label} **${m.d1}%** on D-1${trendTail(m)}`
  if (m.mtd != null) return `${label} **${m.mtd}%** MTD`
  return null
}

function imagesText(f) {
  const parts = []
  parts.push(dailyLead('Sub-6hr delivery', f.sub6))
  const p = f.pendency
  if (p.d1 != null) parts.push(`Pendency **${p.d1}** on D-1${p.d3 != null ? ` (was ${p.d3} on D-3)` : ''}`)
  else if (p.mtd != null) parts.push(`Pendency **${p.mtd}** MTD`)
  if (f.worstP95) parts.push(`${f.worstP95.segment} slowest at P95 **${f.worstP95.value} hrs**`)
  parts.push(mostOffClause(f.mostOff))
  return parts.filter(Boolean)
}

function fulfillmentText(f) {
  const parts = []
  parts.push(dailyLead('Fulfillment', f.fulfillment))
  if (f.sub.d1 != null) parts.push(`${f.subLabel} **${f.sub.d1}%** on D-1${trendTail(f.sub)}`)
  if (f.worstP95) parts.push(`${f.worstP95.segment} slowest at P95 **${f.worstP95.value} hrs**`)
  parts.push(mostOffClause(f.mostOff))
  return parts.filter(Boolean)
}

function adoptionText(f) {
  const parts = []
  const moverIsLeader = f.topMover && f.leader && f.topMover.name === f.leader.name
  const moverPhrase = (m) => `${m.dir} **${Math.abs(m.delta3)}%** over 3 days`
  if (f.leader) {
    // If the leader is also the biggest daily mover, fold the trend into one clause.
    const trend = moverIsLeader ? `, ${moverPhrase(f.topMover)}` : ''
    parts.push(`**${f.leader.name}** leads at **${f.leader.mtd}%** MTD${trend}`)
  }
  if (f.topMover && !moverIsLeader) {
    parts.push(`**${f.topMover.name}** moved most — ${moverPhrase(f.topMover)}`)
  }
  if (f.laggard) parts.push(`**${f.laggard.name}** lags at **${f.laggard.mtd}%**`)
  parts.push(mostOffClause(f.mostOff))
  return parts.filter(Boolean)
}

// Dispatch to the right templated builder for a facts object.
export function templatedCommentary(facts) {
  switch (facts.section) {
    case 'images':
      return imagesText(facts)
    case '360':
    case 'video':
      return fulfillmentText(facts)
    case 'adoption':
      return adoptionText(facts)
    default:
      return ''
  }
}
