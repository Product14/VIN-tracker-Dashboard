// ─── Slack file upload ────────────────────────────────────────────────────────
// Uploads an image to a Slack channel using the current external-upload flow
// (files.upload is deprecated). Three steps:
//   1) files.getUploadURLExternal  → a one-time upload URL + file id
//   2) POST the bytes to that URL
//   3) files.completeUploadExternal → shares the file into the channel
//
// Env: SLACK_BOT_TOKEN (xoxb-…, needs files:write + bot must be in the channel),
//      SLACK_CHANNEL_ID (defaults to the Studio Health channel).

const DEFAULT_CHANNEL = 'C0AKUR5LW86'

async function slackForm(method, token, params) {
  const res = await fetch(`https://slack.com/api/${method}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(params),
  })
  const json = await res.json().catch(() => ({}))
  if (!json.ok) throw new Error(`Slack ${method} failed: ${json.error || res.status}`)
  return json
}

/**
 * @param {Buffer} buffer  image bytes
 * @param {object} opts
 * @param {string} opts.filename
 * @param {string} [opts.title]
 * @param {string} [opts.comment] initial_comment posted with the file
 * @returns {Promise<{file_id:string}>}
 */
export async function uploadJpegToSlack(buffer, { filename, title, comment } = {}) {
  const token = process.env.SLACK_BOT_TOKEN
  if (!token) throw new Error('SLACK_BOT_TOKEN env var is not set')
  const channel = process.env.SLACK_CHANNEL_ID || DEFAULT_CHANNEL

  // 1) reserve an upload URL
  const { upload_url, file_id } = await slackForm('files.getUploadURLExternal', token, {
    filename,
    length: String(buffer.length),
  })

  // 2) upload the bytes
  const form = new FormData()
  form.append('file', new Blob([buffer], { type: 'image/jpeg' }), filename)
  const up = await fetch(upload_url, { method: 'POST', body: form })
  if (!up.ok) throw new Error(`Slack upload POST failed: HTTP ${up.status}`)

  // 3) finalize + share into the channel
  await slackForm('files.completeUploadExternal', token, {
    files: JSON.stringify([{ id: file_id, title: title || filename }]),
    channel_id: channel,
    ...(comment ? { initial_comment: comment } : {}),
  })

  return { file_id }
}
