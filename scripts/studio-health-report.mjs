// Local Studio Health Report tester — no server needed.
//   npm run studio-health:preview   → writes studio-health-preview.html (renders only)
//   npm run studio-health:send      → actually sends the email via the internal API
//
// Loads .env.local and database_url.env automatically (doesn't override real env).
// Uses the same assembly + template as the /api/studio-health-report route so what
// you see/send matches production. Ported from SmartView-App-Adoption; the only
// difference is sending via this project's emailClient.sendDailyReport().

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

// Minimal .env loader (works on any Node 18+; doesn't override real env).
function loadEnv(file) {
  let text
  try {
    text = readFileSync(join(ROOT, file), 'utf8')
  } catch {
    return
  }
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*([\w.]+)\s*=\s*(.*)\s*$/)
    if (!m || line.trimStart().startsWith('#')) continue
    const key = m[1]
    let val = m[2].trim().replace(/^["']|["']$/g, '')
    if (process.env[key] === undefined) process.env[key] = val
  }
}
loadEnv('.env.local')
loadEnv('database_url.env')

// Imported AFTER env is loaded so the sheet-URL / dashboard-URL env reads resolve.
const { buildHtml, subjectStamp } = await import('../server/studio/studioHealthReport.js')
const { sendDailyReport } = await import('../server/emailClient.js')

const { html, rooftops } = await buildHtml()

if (process.argv.includes('send')) {
  const to = (process.env.STUDIO_HEALTH_EMAIL_TO || '').split(',').map((s) => s.trim()).filter(Boolean)
  if (to.length === 0) throw new Error('STUDIO_HEALTH_EMAIL_TO env var is not set')
  const cc = (process.env.STUDIO_HEALTH_EMAIL_CC || '').split(',').map((s) => s.trim()).filter(Boolean)
  const result = await sendDailyReport(html, { to, cc, subject: `Studio Health Report - ${subjectStamp()}` })
  console.log(`✓ Sent — ${rooftops} rows (all stages). API response:`, JSON.stringify(result))
} else {
  const out = join(ROOT, 'studio-health-preview.html')
  writeFileSync(out, html)
  console.log(`✓ Wrote studio-health-preview.html — ${rooftops} rows (all stages)`)
}
