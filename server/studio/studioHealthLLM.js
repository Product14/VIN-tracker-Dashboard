// ─── Optional GPT phrasing for Studio Health Report commentary ────────────────
// Turns the deterministic facts (from studioInsights.js) into short editorial
// prose. This is an ENHANCEMENT layer only: it returns null on any problem (no
// key, non-200, timeout, bad JSON) and the caller falls back to the templated
// commentary, so the email never breaks or stalls.
//
// Env: OPENAI_API_KEY (absent → disabled), OPENAI_MODEL (default gpt-4o-mini).

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions'
const TIMEOUT_MS = 10000

const SYSTEM_PROMPT = `You are an editor polishing bullet-point commentary for an internal Studio operations email.
You will receive draft bullets for four sections (images, 360, video, adoption) as JSON — each section is an
ARRAY of short points, and each point already contains the correct, pre-computed numbers. Rewrite each point
into one crisp, natural bullet an operations lead would read.
STRICT RULES:
- Return the SAME number of bullets per section as the input, one polished bullet per input point, in the same order. Do NOT merge, split, add, or drop points.
- Preserve every number, percentage, and unit EXACTLY as written (e.g. 91%, 6.3 hrs, 1,284, 20%), INCLUDING any trend series in parentheses like (90%→92%→70%) — never drop it.
- Keep all **double-asterisk** bold markers wrapped around those same numbers.
- Do NOT introduce any new figures, segments, percentages, or comparisons not present in the draft.
- Keep each bullet concise and scannable; do not pad with filler (e.g. avoid "with a delivery time of"). No "Most off:" label — phrase the worst-segment point naturally.
Return a JSON object with exactly these keys: "images", "three60", "video", "adoption"; each value is an ARRAY of bullet strings.`

/**
 * @param {object} drafts templated bullets per section { images, three60, video, adoption } (string[])
 * @returns {Promise<{images?:string[],three60?:string[],video?:string[],adoption?:string[]}|null>}
 */
export async function phraseCommentary(drafts) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return null
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini'

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(OPENAI_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.3,
        max_tokens: 500,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: JSON.stringify(drafts) },
        ],
      }),
    })

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      console.warn(`[studio-health-llm] HTTP ${res.status}: ${body.slice(0, 200)} — falling back to templated`)
      return null
    }

    const data = await res.json()
    const content = data?.choices?.[0]?.message?.content
    if (!content) return null
    const parsed = JSON.parse(content)

    // Keep only non-empty string arrays; caller falls back per missing section.
    const out = {}
    for (const key of ['images', 'three60', 'video', 'adoption']) {
      if (Array.isArray(parsed[key])) {
        const clean = parsed[key].filter((x) => typeof x === 'string' && x.trim()).map((x) => x.trim())
        if (clean.length) out[key] = clean
      }
    }
    return Object.keys(out).length ? out : null
  } catch (e) {
    const why = e.name === 'AbortError' ? `timeout after ${TIMEOUT_MS}ms` : e.message
    console.warn(`[studio-health-llm] ${why} — falling back to templated`)
    return null
  } finally {
    clearTimeout(timer)
  }
}
