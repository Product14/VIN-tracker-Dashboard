// ─── HTML → JPEG via headless Chromium ────────────────────────────────────────
// Renders an HTML string to a full-page JPEG buffer. Dual launch path: on Vercel
// (serverless) it uses @sparticuz/chromium's bundled binary; locally it drives the
// system Chrome via CHROME_PATH (default the macOS install). Used to snapshot the
// Studio Health email for posting to Slack.

import puppeteer from 'puppeteer-core'
import chromium from '@sparticuz/chromium'

const MAC_CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

async function launch() {
  // Vercel sets process.env.VERCEL; there we must use the Lambda-compatible Chromium.
  if (process.env.VERCEL) {
    return puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    })
  }
  // Local dev — use an installed Chrome/Chromium.
  return puppeteer.launch({
    headless: true,
    executablePath: process.env.CHROME_PATH || MAC_CHROME,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })
}

/**
 * @param {string} html  full HTML document
 * @param {object} [opts]
 * @param {number} [opts.width=1080]              viewport width (must exceed the template's
 *                                                slack page width, currently 1040px)
 * @param {number} [opts.deviceScaleFactor=2]     retina crispness
 * @returns {Promise<Buffer>} JPEG bytes
 */
export async function htmlToJpeg(html, { width = 1080, deviceScaleFactor = 2 } = {}) {
  const browser = await launch()
  try {
    const page = await browser.newPage()
    await page.setViewport({ width, height: 1200, deviceScaleFactor })
    // The email is inline-CSS + table HTML with no external images, so content settles fast.
    await page.setContent(html, { waitUntil: 'networkidle0' })
    return await page.screenshot({ type: 'jpeg', quality: 85, fullPage: true })
  } finally {
    await browser.close()
  }
}
