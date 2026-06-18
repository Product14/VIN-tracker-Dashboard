// Parser for the matrix-shaped sheet tabs ("Studio Health", "Studio Adoption").
//
// These tabs are NOT header-keyed like the Rooftop Level tab. They have a fixed
// layout: column A = Product Line (only filled on a group's first row), column B
// = Metric, then columns C..L = Target, MTD, ENT, MID, SMB, D-1, D-2, D-3, M-1, M-2.
//
// Parse with Papa { header: false } → array-of-arrays, then feed the resulting
// `data` to parseMatrix(). Values are kept as the sheet's raw strings ("91%",
// "9.0", "NA", "-"); empty cells become "—". The Target column (index 2) is
// intentionally dropped — the report shows MTD..M-2 only.

const norm = (v) => (v ?? '').toString().trim()
const DASH = '—'

// Column header label per emitted key, in display order.
export const COLUMN_KEYS = ['mtd', 'ent', 'mid', 'smb', 'd1', 'd2', 'd3', 'm1', 'm2']
export const COLUMN_HEADERS = ['MTD', 'ENT', 'MID', 'SMB', 'D-1', 'D-2', 'D-3', 'M-1', 'M-2']

// Source array indices for the emitted columns (col C/Target at index 2 is skipped).
const COLUMN_INDEXES = [3, 4, 5, 6, 7, 8, 9, 10, 11]

const cell = (v) => {
  const s = norm(v)
  return s === '' ? DASH : s
}

/**
 * @param {Array<Array<string>>} rows  Papa.parse(csv, { header: false }).data
 * @returns {Map<string, Array<{ metric: string, cols: object }>>}
 *   productLine -> list of { metric, cols: { mtd, ent, ..., m2 } } (raw strings)
 */
export function parseMatrix(rows) {
  const out = new Map()
  let currentLine = ''
  // Skip row 0 (the header row).
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    if (!row) continue
    const line = norm(row[0])
    if (line) currentLine = line
    const metric = norm(row[1])
    if (!metric) continue
    const cols = {}
    COLUMN_KEYS.forEach((key, idx) => {
      cols[key] = cell(row[COLUMN_INDEXES[idx]])
    })
    if (!out.has(currentLine)) out.set(currentLine, [])
    out.get(currentLine).push({ metric, cols })
  }
  return out
}

// Find the product-line group whose name contains `substr` (case-insensitive).
export function pickGroup(map, substr) {
  const needle = substr.toLowerCase()
  for (const [line, metrics] of map.entries()) {
    if (line.toLowerCase().includes(needle)) return metrics
  }
  return []
}

const emptyCols = () => Object.fromEntries(COLUMN_KEYS.map((k) => [k, DASH]))

const toPredicate = (match) =>
  typeof match === 'function' ? match : (m) => m.toLowerCase().includes(match.toLowerCase())

// Find the first metric in a group matching `match` — a substring or a predicate.
// Returns the metric's { mtd..m2 } cols, or an all-"—" row if not found.
export function pickMetric(group, match) {
  const pred = toPredicate(match)
  const hit = (group || []).find((row) => pred(row.metric))
  return hit ? hit.cols : emptyCols()
}

// Like pickMetric but searches every product-line group — for metrics that sit
// under a blank/global product line (e.g. "Avg Media score").
export function pickMetricAnywhere(map, match) {
  const pred = toPredicate(match)
  for (const group of map.values()) {
    const hit = group.find((row) => pred(row.metric))
    if (hit) return hit.cols
  }
  return emptyCols()
}

// The rooftop-level adoption % row (excludes the existing/new-rooftop breakdowns).
// Resolves App/SmartMatch "Adoption - Rooftop (%)" and SmartView "Adoption %".
export function adoptionMatch(metric) {
  const m = metric.toLowerCase()
  return m.includes('adoption') && !m.includes('existing') && !m.includes('new')
}
