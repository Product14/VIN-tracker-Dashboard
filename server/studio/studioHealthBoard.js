// ─── Studio Health Report — Executive Board builder ──────────────────────────
// Renders the Studio Health Report as an on-screen executive board (2×3 grid) —
// same data + design system as the daily email. View-only. Ported from the
// SmartView-App-Adoption project's api/studio-health-board.js; the Express route
// in server/app.js carries the edge-cache header and the ?refresh bypass.

import { fetchStudioSources } from './studioHealthSheets.js'
import { buildStudioHealthPayload } from './studioHealthData.js'
import { buildStudioHealthBoardHtml } from './studioHealthBoardTemplate.js'
import { computeImagesMatrix } from './studioImagesDb.js'

// DB-driven Images rows; null on any DB error so the payload falls back to the sheet.
async function imagesFromDb() {
  try {
    return await computeImagesMatrix({ publishing: 'all' })
  } catch (e) {
    console.warn('[studio-health-board] Images DB metrics failed, falling back to sheet —', e.message)
    return undefined
  }
}

// Build the board fresh: fetch the three sheets + the DB Images metrics in parallel,
// assemble the payload, render the HTML.
async function buildFresh() {
  const [{ rooftopRows, healthMap, adoptionMap }, imagesOverride] = await Promise.all([
    fetchStudioSources(),
    imagesFromDb(),
  ])
  // The funnel + plan (Row 1) are driven entirely by the rooftop tab — if it came back
  // unparseable, fail loudly rather than render a board full of zeros.
  if (!rooftopRows.length) throw new Error('Rooftop Level tab parsed to 0 rows')
  const payload = await buildStudioHealthPayload({ rooftopRows, healthMap, adoptionMap, imagesOverride })
  return buildStudioHealthBoardHtml(payload)
}

// Short in-memory cache so opening/switching to the Studio Health tab is instant
// instead of re-fetching 3 sheets + running the metrics query (~5s) every load. The
// underlying data only moves hourly (sheet) / 3× daily (sync), so a few minutes is
// safe. The Refresh button (?refresh=1 → force) always rebuilds. In Vercel this cache
// doesn't persist across cold starts — the route's edge Cache-Control covers prod.
const TTL_MS = 5 * 60 * 1000
let cache = { html: null, ts: 0 }

/**
 * @param {object} [opts]
 * @param {boolean} [opts.force] bypass the cache and rebuild (Refresh button)
 */
export async function buildBoardHtml({ force = false } = {}) {
  if (!force && cache.html && Date.now() - cache.ts < TTL_MS) return cache.html
  const html = await buildFresh()
  cache = { html, ts: Date.now() }
  return html
}
