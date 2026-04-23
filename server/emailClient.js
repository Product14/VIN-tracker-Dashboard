// ─── Internal Email API Client ────────────────────────────────────────────────
// Calls the internal REST email API.
//
// Required env vars:
//   INTERNAL_EMAIL_API_URL   – e.g. https://abc.cyx.in/send-template-email
//   EMAIL_TO                 – primary recipient for Control Tower report (single address string)
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

  const now = new Date();
  const subjectDate = now.toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const subjectTime = now.toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "numeric",
    hour12: true,
  }).toUpperCase().replace(/\s+/g, " ");
  const subjectLabel = `${subjectDate} ${subjectTime}`;

  const from = process.env.FROM;

  const payload = {
    to,
    ...(cc.length  > 0 && { cc }),
    ...(bcc.length > 0 && { bcc }),
    ...(from && { from }),
    subject:  `Studio Control Tower Report - ${subjectLabel}`,
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

  const responseBody = await res.json().catch(() => ({}));
  console.log("[email] sent successfully — api response:", JSON.stringify(responseBody));
  return responseBody;
}

/**
 * Sends a customer-facing daily report email (rooftop or group).
 * Unlike sendReport(), recipients and subject are caller-supplied, not from env vars.
 *
 * @param {string} html              – Full HTML string built by emailTemplateDaily.js
 * @param {Object} opts
 * @param {string|string[]} opts.to  – Recipient address(es)
 * @param {string} opts.subject      – Email subject line
 */
export async function sendDailyReport(html, { to, cc, subject }) {
  const url = process.env.INTERNAL_EMAIL_API_URL;
  if (!url) throw new Error("INTERNAL_EMAIL_API_URL env var is not set");

  const toArr = Array.isArray(to) ? to : [to];
  if (toArr.length === 0) throw new Error("sendDailyReport: no recipient address provided");
  const ccArr = cc ? (Array.isArray(cc) ? cc : [cc]).filter(Boolean) : [];

  const from = process.env.FROM;

  const payload = {
    to:      toArr,
    ...(ccArr.length > 0 && { cc: ccArr }),
    ...(from && { from }),
    subject,
    template: "email-control-tower-report",
    templateData: { HTMLdata: html },
  };

  console.log(`[email:daily] sending to=${toArr.join(",")} cc=${ccArr.join(",")||"—"} subject="${subject}"`);

  const res = await fetch(url, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Email API responded HTTP ${res.status}: ${body}`);
  }

  const responseBody = await res.json().catch(() => ({}));
  console.log("[email:daily] sent successfully — api response:", JSON.stringify(responseBody));
  return responseBody;
}
