// ─── Studio Health Report — data assembly ────────────────────────────────────
// Turns the three parsed sheet sources into the payload buildStudioHealthHtml()
// expects. Kept here (shared by the endpoint and the local tester) so the
// metric → matcher wiring lives in exactly one place.

import { planCounts, lifecycleFunnel, computeKpis } from './aggregations.js'
import { liveRooftops, operationalRooftops } from './transform.js'
import { pickGroup, pickMetric, pickMetricAnywhere, adoptionMatch } from './studioMetrics.js'

/**
 * @param {object} sources
 * @param {Array}  sources.rooftopRows    normalizeRows() output — ALL stages (Rooftop Level tab)
 * @param {Map}    sources.healthMap      parseMatrix() output (Studio Health tab)
 * @param {Map}    sources.adoptionMap    parseMatrix() output (Studio Adoption tab)
 * @param {Array}  [sources.imagesOverride] DB-computed Images rows (computeImagesMatrix); when
 *                 provided, replaces the sheet-derived Images section. Other sections stay on the sheet.
 * @returns {Promise<object>} payload for buildStudioHealthHtml (async — may call the LLM)
 */
export async function buildStudioHealthPayload({ rooftopRows, healthMap, adoptionMap, imagesOverride, imagesKpis, three60Override, three60Kpis, videoSlack, slack = false }) {
  // Funnel is a cumulative lifecycle view (Contracted ⊇ PWS/Onboarding/Live); all
  // other rooftop math counts only operational rooftops (Live/Onboarding).
  const funnel = lifecycleFunnel(rooftopRows)
  const plan = planCounts(liveRooftops(rooftopRows))

  // Adoption KPI cards (Slack image only) — same counts the Studio Adoption dashboard
  // shows, over the Live/Onboarding rooftop cohort. The template ignores this for email.
  const adoptionKpis = computeKpis(operationalRooftops(rooftopRows))

  const imagesG = pickGroup(healthMap, 'image')
  const three60G = pickGroup(healthMap, '360')
  const videoG = pickGroup(healthMap, 'video')

  // Images is DB-driven when an override is supplied (server/studio/studioImagesDb.js);
  // otherwise fall back to the manually-maintained Studio Health sheet rows.
  const images = imagesOverride || [
    // Two Images rows now contain "6hr": the "(%)" row and a new "# Delivered <6hrs"
    // count (reserved for later). Require "%" so we always pick the percentage, never
    // the count — independent of their row order.
    { label: 'Delivered (&lt;6 hrs) %', cols: pickMetric(imagesG, (m) => m.toLowerCase().includes('6hr') && m.includes('%')) },
    { label: 'Pendency', cols: pickMetric(imagesG, 'pendency') },
    { label: 'P95 Delivery Time (hrs)', cols: pickMetric(imagesG, 'p95') },
    // "Avg Media score" sits under a blank/global product line, so search the whole tab.
    { label: 'Avg Media Score', cols: pickMetricAnywhere(healthMap, 'media') },
  ]

  // 360 is DB-driven from the spin columns when an override is supplied
  // (server/studio/studio360Db.js); otherwise fall back to the Studio Health sheet.
  // "Delivered %" is the Fulfillment row (spelled "Fullfillment" on the sheet).
  const three60 = three60Override || [
    { label: 'Delivered %', sub: '(Fulfillment)', cols: pickMetric(three60G, 'ful') },
    { label: 'Delivered (&lt;6 hrs) %', cols: pickMetric(three60G, '6hr') },
    { label: 'Pendency', cols: pickMetric(three60G, 'pendency') },
    { label: 'P95 Delivery Time (hrs)', cols: pickMetric(three60G, 'p95') },
  ]

  const video = [
    { label: 'Delivered %', sub: '(Fulfillment)', cols: pickMetric(videoG, 'ful') },
    { label: 'Delivered (&lt;12 hrs) %', cols: pickMetric(videoG, '12hr') },
    { label: 'Pendency', cols: pickMetric(videoG, 'pendency') },
    { label: 'P95 Delivery Time (hrs)', cols: pickMetric(videoG, 'p95') },
  ]

  // Video KPI cards (Slack image only) — sourced from the purpose-built "Video Slack"
  // sheet tab (one row of named columns). undefined when the tab is missing/unparseable,
  // so the template falls back to the Video table. counts default 0; pct/p95 → null ("—").
  const num = (v) => {
    const n = Number(String(v ?? '').replace(/,/g, '').trim())
    return Number.isFinite(n) ? n : null
  }
  const videoKpis = videoSlack
    ? {
        videosDelivered: num(videoSlack.vid_del) ?? 0,
        deliveredOver12h: num(videoSlack.videos_delivered_after_12hrs) ?? 0,
        pendencyOver12h: num(videoSlack.pending_after_12hrs) ?? 0,
        pendencyTotal: num(videoSlack.qc_pending) ?? 0,
        deliveredUnder12hPct30: num(videoSlack.videos_delivered_under_12hrs_pct_rolling30),
        p95Delivery30: num(videoSlack.p95_delivery_hrs_rolling30),
      }
    : undefined

  const adoption = [
    { label: 'App', cols: pickMetric(pickGroup(adoptionMap, 'app'), adoptionMatch) },
    { label: 'SmartView VDP', cols: pickMetric(pickGroup(adoptionMap, 'smartview'), adoptionMatch) },
    { label: 'SmartMatch', cols: pickMetric(pickGroup(adoptionMap, 'match'), adoptionMatch) },
    { label: 'SmartView VLP', cols: pickMetric(pickGroup(adoptionMap, 'vlp'), adoptionMatch) },
    { label: 'Smart Campaign', cols: pickMetric(pickGroup(adoptionMap, 'campaign'), adoptionMatch) },
  ]

  // Insights/commentary removed from the report — sections show metric tables only.
  // imagesKpis (current-snapshot + rolling-30 counts) is passed straight through; the
  // board template ignores it. `slack` switches the Images section to the cards-only
  // layout in the template (Slack JPEG only).
  return { funnel, planCounts: plan, images, three60, video, adoption, imagesKpis, three60Kpis, videoKpis, adoptionKpis, slack }
}
