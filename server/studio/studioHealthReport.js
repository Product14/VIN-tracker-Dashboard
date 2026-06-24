// ─── Studio Health Report — daily email builder ──────────────────────────────
// Reads the three Studio Health sheet tabs, renders the matrix as an HTML email,
// and (via the Express route in server/app.js) sends it through the internal email
// API. Ported from the SmartView-App-Adoption project's api/studio-health-report.js;
// the only adaptation is that sending is done by the caller using this project's
// emailClient.sendDailyReport(), so this module just builds the HTML.
//
// Add ?preview=1 on the route to return the rendered HTML instead of sending.

import { fetchStudioSources } from './studioHealthSheets.js'
import { buildStudioHealthPayload } from './studioHealthData.js'
import { buildStudioHealthHtml } from './studioHealthTemplate.js'
import { computeImagesMatrix, computeImagesKpis } from './studioImagesDb.js'

// DB-driven Images rows; null on any DB error so the payload falls back to the sheet.
async function imagesFromDb() {
  try {
    return await computeImagesMatrix({ publishing: 'all' })
  } catch (e) {
    console.warn('[studio-health] Images DB metrics failed, falling back to sheet —', e.message)
    return undefined
  }
}

// Current-snapshot Images KPI cards (email only); undefined on DB error so the email still renders.
async function kpisFromDb() {
  try {
    return await computeImagesKpis({ publishing: 'all' })
  } catch (e) {
    console.warn('[studio-health] Images KPIs failed, omitting KPI cards —', e.message)
    return undefined
  }
}

// `slack` (default false) tailors the Images section for the Slack JPEG: 4 KPI cards
// (incl. rolling-30 metrics) and no metric table. The email passes nothing → unchanged.
export async function buildHtml({ slack = false } = {}) {
  const [{ rooftopRows, healthMap, adoptionMap }, imagesOverride, imagesKpis] = await Promise.all([
    fetchStudioSources(),
    imagesFromDb(),
    kpisFromDb(),
  ])
  const payload = await buildStudioHealthPayload({ rooftopRows, healthMap, adoptionMap, imagesOverride, imagesKpis, slack })
  return { html: buildStudioHealthHtml(payload), rooftops: rooftopRows.length }
}

// "5 Jun 2026, 1 PM IST" — used in the subject line (ported from the SmartView
// email client's subjectStamp so the subject matches the original report).
export function subjectStamp() {
  const now = new Date()
  const date = now.toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
  const time = now
    .toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', hour12: true })
    .toUpperCase()
    .replace(/\s+/g, ' ')
  return `${date}, ${time} IST`
}
