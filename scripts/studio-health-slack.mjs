// Local tester for the Studio Health → Slack image.
//   npm run studio-health:slack -- --preview   → writes studio-health.jpg (no Slack post)
//   npm run studio-health:slack                → renders + uploads to the Slack channel
//
// Loads .env.local and database_url.env (so DB + SLACK_* vars resolve). Uses the same
// email builder as the report, so the image matches what the email/board show.

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

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
    const val = m[2].trim().replace(/^["']|["']$/g, '')
    if (process.env[key] === undefined) process.env[key] = val
  }
}
loadEnv('.env.local')
loadEnv('database_url.env')

// Imported AFTER env load so sheet/DB/Slack env reads resolve.
const { buildHtml, subjectStamp } = await import('../server/studio/studioHealthReport.js')
const { htmlToJpeg } = await import('../server/studio/renderImage.js')
const { uploadJpegToSlack } = await import('../server/studio/slackClient.js')

const { html } = await buildHtml()
const jpeg = await htmlToJpeg(html)

if (process.argv.includes('--preview')) {
  const out = join(ROOT, 'studio-health.jpg')
  writeFileSync(out, jpeg)
  console.log(`✓ Wrote studio-health.jpg (${(jpeg.length / 1024).toFixed(0)} KB) — no Slack post`)
} else {
  const stamp = subjectStamp()
  const safe = stamp.replace(/[^\w]+/g, '-')
  const result = await uploadJpegToSlack(jpeg, {
    filename: `studio-health-${safe}.jpg`,
    title: `Studio Health Report — ${stamp}`,
    comment: `Studio Health Report — ${stamp}`,
  })
  console.log(`✓ Posted to Slack — file_id=${result.file_id} (${(jpeg.length / 1024).toFixed(0)} KB)`)
}
