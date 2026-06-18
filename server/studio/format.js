// "FRANCHISE_DEALER" -> "FRANCHISE DEALER" (display only; keep the raw value for filtering/colors)
export function noUnderscore(s) {
  return (s ?? '').replace(/_/g, ' ')
}

// "aman.seth@spyne.ai" -> "aman.seth"; non-emails (e.g. "Unassigned") pass through unchanged.
export function shortEmail(s) {
  const v = s ?? ''
  const at = v.indexOf('@')
  return at === -1 ? v : v.slice(0, at)
}

export function fmtInt(n) {
  return (n ?? 0).toLocaleString('en-US')
}

export function fmtMoney(n) {
  return '$' + Math.round(n ?? 0).toLocaleString('en-US')
}

// Compact money: 5_070_000 -> "$5.07M", 115_000 -> "$115K", 900 -> "$900".
export function fmtMoneyCompact(n) {
  const v = n ?? 0
  if (Math.abs(v) >= 1e6) return '$' + (v / 1e6).toFixed(2) + 'M'
  if (Math.abs(v) >= 1e3) return '$' + Math.round(v / 1e3) + 'K'
  return '$' + Math.round(v)
}

export function pct(value, total) {
  if (!total) return '0%'
  return Math.round((value / total) * 100) + '%'
}

// ratio in [0,1] -> "38%"
export function pctOf(ratio) {
  return Math.round((ratio ?? 0) * 100) + '%'
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// "2026-04" -> "Apr 2026"
export function monthLabel(ym) {
  if (!ym) return '—'
  const [y, m] = ym.split('-')
  return `${MONTHS[Number(m) - 1]} ${y}`
}

// "2026-05-12" -> "12 May 2026"
export function ymdLabel(ymd) {
  if (!ymd) return '—'
  const [y, m, d] = ymd.split('-').map(Number)
  return `${d} ${MONTHS[m - 1]} ${y}`
}

// "2026-05-12" (week-start Monday) -> "Week of 12 May 2026"
export function weekLabel(ymd) {
  if (!ymd) return '—'
  return `Week of ${ymdLabel(ymd)}`
}

// Date -> "30 May 2025"
export function dateLabel(d) {
  if (!d) return '—'
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

// "YYYY-MM-DD" for <input type="date"> values
export function toInputDate(d) {
  if (!d) return ''
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function relativeTime(date) {
  if (!date) return ''
  const sec = Math.floor((Date.now() - date.getTime()) / 1000)
  if (sec < 60) return 'just now'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min} minute${min === 1 ? '' : 's'} ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr} hour${hr === 1 ? '' : 's'} ago`
  const day = Math.floor(hr / 24)
  return `${day} day${day === 1 ? '' : 's'} ago`
}
