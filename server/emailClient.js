// ─── Internal Email API Client ────────────────────────────────────────────────
// Calls the internal REST email API.
//
// Required env vars:
//   INTERNAL_EMAIL_API_URL   – e.g. https://abc.cyx.in/send-template-email
//   EMAIL_TO                 – primary recipient (single address string)
//   EMAIL_CC                 – comma-separated CC addresses (optional)
//   EMAIL_BCC                – comma-separated BCC addresses (optional)

function splitAddresses(envVal) {
  return (envVal || "").split(",").map(s => s.trim()).filter(Boolean);
}

/**
 * Sends the dashboard snapshot email via the internal email API.
 *
 * @param {string} html       – Full HTML string built by emailTemplate.js
 * @param {string} timeLabel  – e.g. "12:00 PM IST"
 */
export async function sendReport(html, timeLabel) {
  const url = process.env.INTERNAL_EMAIL_API_URL;
  if (!url) throw new Error("INTERNAL_EMAIL_API_URL env var is not set");

  const to  = splitAddresses(process.env.EMAIL_TO);
  if (to.length === 0) throw new Error("EMAIL_TO env var is not set");

  const cc  = splitAddresses(process.env.EMAIL_CC);
  const bcc = splitAddresses(process.env.EMAIL_BCC);

  const payload = {
    to,
    ...(cc.length  > 0 && { cc }),
    ...(bcc.length > 0 && { bcc }),
    subject:  `Control Tower Report — ${timeLabel}`,
    template: "email-control-tower-report",
    templateData: {
      HTMLdata: html,
    },
  };

  console.log(`[email] sending to=${to} cc=${cc.join(",")||"—"} subject="${payload.subject}"`);

  const res = await fetch(url, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Email API responded HTTP ${res.status}: ${body}`);
  }

  console.log("[email] sent successfully");
  return res.json().catch(() => ({}));
}
