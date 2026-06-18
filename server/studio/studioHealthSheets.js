// ─── Studio Health Report — shared sheet sourcing ────────────────────────────
// Fetches + parses the three Google Sheet tabs the Studio Health Report and Board
// both read, so the fetch/retry logic and the metric → matcher wiring live in one
// place. Ported from the SmartView-App-Adoption project's per-handler fetch code.
//
//   • Rooftop Level   (gid 0)          → plan tiers + funnel (header-keyed CSV)
//   • Studio Health   (gid 1632148391) → Images / 360 / Video delivery metrics (matrix)
//   • Studio Adoption (gid 1323822955) → App / SmartView VDP / SmartMatch adoption % (matrix)

import Papa from 'papaparse'
import { normalizeRows } from './transform.js'
import { parseMatrix } from './studioMetrics.js'

const SHEET_ID = '1VDvn6ZcHfRYdjtVHi2aJ06tylbKX2TyC9Lvhg-0-078'
const gvizUrl = (gid) =>
  `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&gid=${gid}`
// The matrix tabs mix value types within a column (%, plain numbers, "4.3s"). The gviz
// CSV endpoint infers one type per column and silently drops cells that don't match it,
// so use the plain CSV export, which preserves every cell verbatim.
const exportCsvUrl = (gid) =>
  `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${gid}`

const ROOFTOP_CSV_URL = process.env.SHEET_CSV_URL || gvizUrl(0)
const STUDIO_HEALTH_CSV_URL = process.env.STUDIO_HEALTH_CSV_URL || exportCsvUrl('1632148391')
const STUDIO_ADOPTION_CSV_URL = process.env.STUDIO_ADOPTION_CSV_URL || exportCsvUrl('1323822955')

// Reliable CSV fetch: per-attempt timeout (so a hung Google request can't stall the
// whole function) + retries with linear backoff for transient upstream errors, and a
// guard against empty / HTML-error-page responses that would otherwise parse to junk.
async function fetchCsv(url, { label = 'sheet', retries = 2, timeoutMs = 10000 } = {}) {
  let lastErr
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const upstream = await fetch(url, { redirect: 'follow', signal: controller.signal })
      if (!upstream.ok) throw new Error(`HTTP ${upstream.status}`)
      const text = await upstream.text()
      if (!text || !text.trim()) throw new Error('empty response')
      // gviz/export return CSV; an auth/error page comes back as HTML — reject it.
      if (/^\s*<(?:!doctype|html)/i.test(text)) throw new Error('got HTML, not CSV (sheet not link-shared?)')
      return text
    } catch (e) {
      lastErr = e
      if (attempt < retries) await new Promise((r) => setTimeout(r, 400 * (attempt + 1)))
    } finally {
      clearTimeout(timer)
    }
  }
  throw new Error(`Failed to fetch ${label} after ${retries + 1} attempts: ${lastErr?.message}`)
}

/**
 * Fetch + parse all three tabs into the shape buildStudioHealthPayload() expects.
 * @returns {Promise<{ rooftopRows: Array, healthMap: Map, adoptionMap: Map }>}
 */
export async function fetchStudioSources() {
  const [rooftopCsv, healthCsv, adoptionCsv] = await Promise.all([
    fetchCsv(ROOFTOP_CSV_URL, { label: 'Rooftop Level' }),
    fetchCsv(STUDIO_HEALTH_CSV_URL, { label: 'Studio Health' }),
    fetchCsv(STUDIO_ADOPTION_CSV_URL, { label: 'Studio Adoption' }),
  ])

  const rooftopRows = normalizeRows(Papa.parse(rooftopCsv, { header: true, skipEmptyLines: true }).data)
  const healthMap = parseMatrix(Papa.parse(healthCsv, { header: false, skipEmptyLines: false }).data)
  const adoptionMap = parseMatrix(Papa.parse(adoptionCsv, { header: false, skipEmptyLines: false }).data)

  return { rooftopRows, healthMap, adoptionMap }
}
