# Dream Automotive — Notification Dispositions & Outcomes

**Scope:** Issue #1 only — *"I want to know every time Emily has contact with one of our customers, sets an appointment, or answers a fresh lead. I do NOT need to be alerted every time she attempts to make contact with someone and is unsuccessful or leaves a voicemail."*

The other issues (false-sold, OTD pricing, appointment-confirmation cadence, testing access) are tracked separately.

---

## The default rule (one sentence)

> Notify on **any customer-initiated touch**, **any state change that affects sale probability**, and **any handoff to a human**. Suppress **outbound attempts that never reached the customer**.

Everything below is just the literal enumeration of that rule against every disposition the system actually produces.

---

> **Note on layers.** Sections 1–4 below describe the *raw* per-row signals (telephony dispositions, SMS delivery state, lifecycle events). The canonical signal we actually fire notifications on is the **`outcome`** value the classifier emits per conversation — see **§11**. When both exist, `outcome` wins. The raw signals are kept as the fallback layer for cases the outcome enum doesn't cover (e.g. system errors, undelivered SMS, internal SLA monitoring).

## 1 · Call dispositions (the `call_ended_reason` field)

Counts come from the live dataset (~35k activity rows, May window) so we can see the volume each rule would suppress vs surface.

### Outbound calls — Emily dials the customer

| `call_ended_reason` | What happened | Notify? | Reasoning |
|---|---|---|---|
| `voicemail` | Hit voicemail; message left or not | **No** | The literal example Tanessa called out. ~22k rows — would be massive notification spam. |
| `customer-did-not-answer` | Rang out | **No** | No customer contact. |
| `customer-busy` | Line busy | **No** | No customer contact. |
| `twilio-failed-to-connect-call` | Telephony layer failed | **No** to dealer · **Yes** to internal SLA monitor | Not a customer event; is a reliability event for us. |
| `silence-timed-out` | Connected but no speech detected | **No** | Likely answered-and-hung-up or robocall sieve. |
| `assistant-ended-call-after-message-spoke` | Customer connected, Emily delivered her opener, customer didn't engage | **Yes — low priority** | Customer *did* hear Emily; counts as a touch even if no conversation. Daily digest is fine. |
| `customer-ended-call` | Customer engaged and then hung up | **Yes** | A real conversation happened. Always notify. |
| `assistant-forwarded-call` | Emily transferred the call to a human | **Yes — urgent** | Live handoff; sales team needs to know now. |
| `pipeline-error-cancelled` / unknown | Anything we can't classify | **No** to dealer · **Yes** to internal log | Fail-safe quiet. |

### Inbound calls — customer dials the dealership number

| Outcome | Notify? | Reasoning |
|---|---|---|
| Connected to Emily, conversation happened | **Yes — urgent** | This is the **"answers a fresh lead"** clause verbatim. The cases from Tanessa's email (575-403-1428, 618-917-3695, 785-329-4511) live here. |
| Connected, customer hung up before Emily finished greeting | **Yes** | Interest signal — someone tried to reach the dealership. |
| Forwarded to human (during business hours or per fallback rules) | **Yes — urgent** | Handoff event. |
| IVR / busy-tone / never reached Emily | **No** to dealer · **Yes** to internal SLA | Telephony issue. |

---

## 2 · SMS dispositions

There's no `call_ended_reason` for SMS; we infer disposition from direction and whether the customer ever replied.

| Case | Notify? | Reasoning |
|---|---|---|
| Outbound SMS sent, **no customer reply yet** | **No** | Same logic as voicemail — Emily attempted contact, nothing came back. |
| Outbound SMS sent, **customer replies** | **Yes — on every reply** | Customer-initiated touch from this point onward. |
| Inbound SMS from a known customer | **Yes** | Customer-initiated. |
| Inbound SMS from an **unknown number** (creates a new lead) | **Yes — urgent** | "Answers a fresh lead" clause. |
| Customer texts `STOP` / `UNSUBSCRIBE` | **Yes — urgent** | Compliance event; sales team must know to stop outreach. |
| SMS delivery failure (carrier reject, invalid number) | **No** to dealer · **Yes** to internal log | Telephony issue. |

---

## 3 · Lead-lifecycle events (independent of channel)

These fire from the lead/CRM side, not from an individual call/SMS.

| Event | Notify? | Reasoning |
|---|---|---|
| **Lead created — fresh** (no prior record of this customer) | **Yes — urgent** | Tanessa's "fresh lead" clause. |
| **Lead created — match to existing customer** (returning shopper) | **Yes** | Reactivation is high value; ensures sales team doesn't treat them like a new prospect. |
| **Lead status change** (`NEW_LEAD` → `STORE_VISIT` / `PROPOSAL` / `DELIVERED` / `LOST`) | **Yes** | Each is a meaningful transition. |
| **Appointment pitched** (Emily offered, customer didn't confirm) | **No** | Just a data point; not a commitment. Shows up in dashboard. |
| **Appointment scheduled** (customer confirmed) | **Yes — urgent** | Tanessa's "sets an appointment" clause. |
| **Appointment rescheduled / cancelled** | **Yes — urgent** | Same priority as setting — sales team needs to recapture. |
| **Action item created** (de-duplicated per current rule) | **Yes** | But see Issue #4 — the dedup window itself is under dispute. |
| **Action item created — duplicate within window** | **No** *today* · TBD after Issue #4 is resolved | Current behavior; Tanessa wants this changed. |
| **Lead handed to human / `humanTakenOverAt` set** | **Yes — urgent** | The dealership has assumed the conversation. |
| **Lead marked LOST** | **Yes** | So no one keeps working it. |

---

## 4 · Content-extracted signals (best-effort, from the agent's transcript / summary)

These are inferred from the conversation, not from raw dispositions. They're notify-on-top — i.e. the underlying call/SMS rule still applies, but these add urgency or routing.

| Signal | Notify? | Effect |
|---|---|---|
| Customer asked for **out-the-door price** / financing / total | **Yes — urgent** | High intent; sales team handoff candidate. |
| Customer asked about a **specific in-stock vehicle** | **Yes** | Inventory question; possibly a buyer. |
| Customer mentioned a **timeline** ("this weekend", "tomorrow") | **Yes** | Urgency signal. |
| Customer brought up a **trade-in** | **Yes** | Multi-step deal; needs human. |
| Customer expressed **frustration / rage-quit** | **Yes — urgent** | Reputation risk. |
| Customer asked to **speak to a human** | **Yes — urgent** | Direct escalation. |
| Customer is **silent ≥ N days** then resumes conversation | **Yes — urgent** | Reactivation; high-value moment. |

---

## 5 · Suppression rules (explicit — to be loud about what we're *not* surfacing)

These are intentional silence. If the dealership asks "why didn't I get notified", the answer is in this list.

1. **Outbound attempts that don't reach the customer** — voicemail, busy, no-answer, ring-out, telephony failure.
2. **Outbound SMS with no customer reply** — counted in the dashboard, not pushed.
3. **System-side errors** — go to our internal SLA log, not to the dealer.
4. **Duplicate action items within the dedup window** — current default; revisit after Issue #4 resolution.
5. **Appointment pitched but not confirmed** — data point, not a notification.

---

## 6 · Notification payload (what each notification carries)

Every notification, urgent or not, includes:

- Customer name + phone (or "Unknown" with phone if name absent)
- Lead source (e.g. "Dream Nissan", "CarGurus")
- Rooftop (Lawrence / Legends / Midwest)
- Trigger event (one of the cases above)
- Timestamp
- One-line conversation summary (if available)
- Direct deep link to the lead in the dashboard

Urgent notifications add:
- Priority flag for top-of-feed pinning
- Push to the dealer's configured real-time channel(s)

---

## 7 · Configurability (per the whiteboard)

Per-dealer settings (Dream defaults shown; other dealers will override):

| Knob | Dream default |
|---|---|
| Default notification verbosity | All qualifying events from §1–§3 |
| Real-time push channels | TBD with Tanessa (SMS / email / Slack — pick) |
| Quiet hours | None (24/7 — dealership decides response cadence) |
| Per-rooftop routing | Lawrence / Legends / Midwest each route to their own desk |
| Voicemail attempts | **Suppressed** (per Tanessa) |
| Outbound-SMS-no-reply | **Suppressed** (per Tanessa) |
| `assistant-ended-call-after-message-spoke` | Daily digest, not real-time |

Per-CRM (ProMax for Dream): which of the above events also push **into the CRM** vs stay in the dashboard. This is a separate mapping from the notification rules and is governed by what ProMax actually accepts (Issue #4 / lifecycle event design).

---

## 8 · Open questions for tech / product

1. **Threshold for "engaged" on `assistant-ended-call-after-message-spoke`** — do we count it as a touch (current proposal: yes, daily digest)?
2. **Reactivation window** — how many days of silence before a follow-up message counts as "re-engagement" worth a notification? Suggest 3 days; confirm with Tanessa.
3. **De-dup of notifications themselves** — if a customer sends 5 SMS in 2 minutes, do we send 5 push notifications or 1 batched? Suggest batch within a 2-min window per lead.
4. **CRM push parity** — when notification fires, is it also pushed to ProMax? Default yes, except for low-priority and SLA-internal cases.
5. **Failure to deliver a notification** — retry policy + escalation path. Not customer-visible, but needs to be defined.
6. **Test / staging mode** — how does the dealership validate this is working without using real numbers? Ties to Issue #6 (test recordings / sandbox phone numbers).

---

## 9 · Live SMS conversations — how often we fire (the "no edit" constraint)

**The problem.** An SMS conversation is rapid-fire: customer replies, Emily replies, customer replies again, Emily replies again — easily 4–8 messages in 5 minutes. If we naïvely fire a push notification on every inbound message we (a) spam the dealer and (b) can't go back and reconcile, because **push notifications are write-once — there is no edit / supersede primitive** on SMS, email, or Slack-bot pushes.

So we can't do "send first, then update."  We have to decide once, at the right moment, what to send.

### The rule for an active SMS conversation

We treat the whole back-and-forth as **one conversation object** and fire notifications on **state transitions**, not on each message.

| Event in the conversation | Notify? | What the dealer sees |
|---|---|---|
| **First customer reply** (the conversation just became real) | **Yes — one push** | "Customer X is replying to Emily. View live →" |
| Every subsequent inbound SMS in the same conversation | **No push** · live in dashboard | Dashboard updates immediately; no spam to the dealer. |
| Emily's outbound replies inside the conversation | **No push** ever | The agent's own actions never page the dealer. |
| **Intent escalation detected mid-conversation** (price asked, specific vehicle, timeline, trade-in, "speak to a human", rage-quit, STOP) — see §4 | **Yes — one push per signal** | "Customer X just asked for OTD pricing." Routed urgent. |
| **Appointment scheduled** from within the conversation | **Yes — urgent push** | "Appointment set with X for [time]." |
| Conversation **idles for ≥ 10 minutes** without a customer message | No push; mark conversation closed in the dashboard | Quiet. |
| Customer replies **after the 10-min idle window** | **Yes — new "conversation resumed" push** | Treated as a new conversation; fresh single notification. |

Net effect: a typical 6-message SMS conversation produces **1 push at the start**, **0–2 pushes for escalations**, and **at most 1 push at the end** (appointment / handoff). Not 6.

### Why 10 minutes for the idle window

It's long enough that a real conversation doesn't get artificially split when the customer takes a beat to look at their phone, and short enough that a returning customer the next day is correctly treated as a fresh re-engagement. Tunable per-dealer.

### What "live in the dashboard" means

The dashboard at `/dream` is the **always-on view** for the conversation while it's in progress. It needs to keep up:

- **Auto-refresh every 60 seconds** while a tab is open (server cache is already 5 min; we'll drop the dream cache to 60 s for this).
- **Manual refresh button** stays for when the dealer wants to force a pull.
- *(Future)* SSE / WebSocket push from the server when a new activity row lands — eliminates the polling lag entirely. Not in v1; the 60-s poll is good enough for "Tanessa wants to know."

So:
- **Push notifications** = "stop what you're doing and look" (1 at conversation start, then escalations only).
- **Dashboard** = "the live conversation" (refreshes itself, no need to push every message).

### Why this works given the "no edit" constraint

We never have to *correct* a notification, because we only send a notification when we're confident the event matters on its own:

- "Conversation started" is true regardless of what happens next.
- An escalation signal (OTD ask, request for human) is a discrete fact — sending it doesn't get invalidated if the customer keeps replying.
- "Appointment scheduled" is terminal-positive.
- "Conversation resumed after silence" is its own discrete event.

What we deliberately *don't* notify on are the in-between messages, which is exactly where the edit-after-send problem would bite us.

### Sanity check against Tanessa's contract

> "I want to know every time Emily has contact with one of our customers, sets an appointment, or answers a fresh lead. I do NOT need to be alerted every time she attempts to make contact with someone and is unsuccessful or leaves a voicemail."

- "Every time Emily has contact" — covered by the "first reply" push and the resumed-conversation push. The mid-conversation messages aren't *new* contacts, they're continuations of the same one.
- "Sets an appointment" — explicit push.
- "Answers a fresh lead" — covered by the inbound-from-unknown-number rule in §2, which produces exactly one push.
- "Don't alert me every time she's unsuccessful" — voicemails / no-replies stay suppressed.

The contract is satisfied without flooding the dealer's phone.

---

## 10 · Outcome → Notification mapping (canonical)

This is the rule set we actually run on. The classifier emits one outcome per conversation from a **closed enum** (see `outcomes.md`); we don't accept free-text labels, so every notification decision is a table lookup.

### How this composes with the override rule

- **Lead-level outcome transitions** are what trigger pushes. The override rule (terminal absorbs · tier 2 > tier 1 · latest wins same-tier) means we naturally fire on real progress, not on chatter.
- **Task-level-only outcomes** (the "Not Connected" flat buckets in both Sales and Service) never become lead outcomes and therefore never push to the dealer. They live in the dashboard and in our internal retry pool.
- A push notification is sent only when the lead's outcome moves *up* the priority ladder, not when the same outcome is re-stamped by a later task. (E.g. a second Pricing Inquiry on the same lead doesn't push again.)

### Priority tiers (drive notification routing)

| Tier | Channel | Latency | When |
|---|---|---|---|
| **P0 · Urgent push** | All configured real-time channels | < 30 s | Terminal-positive outcomes; live handoffs; explicit human ask; opt-out / compliance |
| **P1 · Standard push** | Default real-time channel | < 2 min | Commercial interest, meaningful engagement, permanent disqualification, data invalidity |
| **P2 · Dashboard-only** | Live feed only — no push | n/a | Shallow engagement (L3 rest states), generic info-shares |
| **P3 · Suppressed** | Not surfaced to dealer; logged internally | n/a | Not-Connected bucket; SMS undelivered; system errors |

### Sales

#### L1 — Terminal States

| Outcome | Tier | Push copy template |
|---|---|---|
| Appointment | **P0** | "Appointment set with {customer} at {time} · {vehicle?}" |
| Deposit Placed | **P0** | "{customer} placed a deposit · {amount?} on {vehicle?}" |
| Purchase Closed | **P0** | "{customer} closed — deal complete" |
| Human Transferred | **P0** | "Call live-transferred to your team · {customer} on the line" |
| Human Requested | **P0** | "{customer} asked to speak with a person — callback {when?}" |
| Pricing Inquiry | **P1** | "{customer} asked about pricing on {vehicle?}" |
| Financing Inquiry | **P1** | "{customer} asked about payments / financing" |
| Trade Inquiry | **P1** | "{customer} wants a trade-in value on {vehicle?}" |
| Ancillary Inquiry | **P1** | "{customer} asked about warranty / insurance / registration" |
| Not Interested | **P1** | "{customer} declined — not in market" |
| Already Purchased | **P1** | "{customer} bought from a competitor — close the lead" |
| Do Not Call | **P0** | "{customer} requested no further contact" |
| Opt Out | **P0** | "{customer} opted out — suppression list updated" |
| Wrong Number | **P1** | "Number doesn't belong to {customer} — data fix needed" |

#### L2 — Engagement (currently empty — temporarily routed to L1 Commercial Interest)

When Sales L2 is reintroduced, the Commercial Interest outcomes above move here at tier **P1**, dashboard-only auto-refresh, with a push only on the *first* occurrence per lead.

#### L3 — Rest States

| Outcome | Tier | Note |
|---|---|---|
| Vehicle Inquiry | **P1** | First time per lead — push. Subsequent: dashboard. |
| Reconnect Needed | **P1** | Push — sales team needs to know when the customer wants to be reached. |
| Operating Hours | **P2** | Dashboard only. |
| Language Barrier | **P2** | Dashboard only — operator can decide to route. |
| Decision Maker Unavailable | **P2** | Dashboard only. |
| General Engagement | **P2** | Dashboard only — by definition, no surfaced intent. |

#### Not Connected — Flat Bucket

All **P3**. Voicemail · Call Disconnected · Call Aborted · Recording Declined · No Response → never push. These are exactly what Tanessa asked to suppress.

### Service

#### L1 — Terminal States

| Outcome | Tier | Push copy template |
|---|---|---|
| Service Appointment Booked | **P0** | "Service appointment booked · {customer} · {time} for {service}" |
| Appointment Rescheduled | **P0** | "{customer} moved their service appointment to {time}" |
| Appointment Cancelled | **P0** | "{customer} cancelled — CRM ownership" |
| Customer Already Self Booked | **P1** | "{customer} already booked directly — no action needed" |
| Walk In Committed | **P0** | "{customer} committed to a walk-in" |
| Customer Permanently Declined | **P1** | "{customer} declined permanently — suppress" |
| Do Not Contact Requested | **P0** | "{customer} requested no contact — suppression list updated" |
| Customer Permanently Using Competitor | **P1** | "{customer} confirmed using another shop permanently" |
| Customer No Longer Owns Vehicle | **P1** | "{customer} no longer owns the vehicle — close the lead" |
| Vehicle Sold Or Traded | **P1** | "Vehicle on file was sold/traded — close the lead" |
| Vehicle Written Off | **P1** | "Vehicle on file totaled / scrapped — close the lead" |
| Customer Relocated | **P1** | "{customer} moved out of service area" |
| Customer Deceased | **P1** | "Customer confirmed deceased — archive" |
| Wrong Number / Number Disconnected / Duplicate Lead | **P1** | Data hygiene push — bundle to a daily digest if volume spikes. |

#### L2 — Engagement States

| Outcome | Tier | Note |
|---|---|---|
| Callback Requested | **P0** | Push — sales team must call back at the asked time. |
| No Slots Available | **P0** | Push — scheduling team needs to open slots / call. |
| Transferred To Service Team | **P0** | Push — live handoff. |
| Drop Off Details Shared / Pickup Details Shared / Loaner Details Shared | **P1** | Logistical engagement; first occurrence per lead pushes. |
| Recall Information Shared / Warranty Information Shared / Service Package Information Shared | **P1** | Substantive content exchange; push first time. |
| Price Estimate Shared | **P1** | Pricing engagement — sales-team-worthy. |
| Parts Availability Discussed | **P1** | Parts team handoff candidate. |
| Customer Considering | **P1** | Push — service advisor should follow up. |
| Customer Open To Return | **P1** | Push — competitive win opportunity. |

#### L3 — Rest States

| Outcome | Tier | Note |
|---|---|---|
| General Information Shared | **P2** | Dashboard only. |
| Operating Hours Shared | **P2** | Dashboard only. |
| Location Shared | **P2** | Dashboard only. |
| Soft Decline | **P2** | Dashboard only — not a firm no. |
| Customer Busy No Callback | **P2** | Dashboard only — no callback time given. |
| Could Not Conclude | **P2** | Dashboard only — operator can retry. |
| Language Barrier | **P2** | Dashboard only. |

#### Not Connected — Flat Bucket

All **P3**. No Answer · Voicemail Left · Call Disconnected · Call Aborted · Third Party Answered · SMS Delivered No Response · SMS Undelivered → never push.

### The "fresh inbound lead" case (the one Tanessa flagged)

A fresh inbound lead is **not** itself in the outcome enum — it's a **lifecycle event** that happens *before* the conversation gets classified. We push at lead-creation time with priority **P0**:

> "Fresh lead · {customer} just reached out via {channel} · {source}"

That push fires regardless of what outcome the conversation later resolves to. If the conversation then resolves to e.g. Appointment, a second P0 push fires for the appointment. (Two pushes — both warranted; different events.)

### Override semantics on notifications

Because the lead-level outcome follows the override rule from `outcomes.md`:

- A P1 outcome (e.g. Pricing Inquiry) **does not** push again if it's the second time at the same tier on the same lead — the lead-level outcome is unchanged.
- A P0 terminal outcome (e.g. Appointment) **does** push when it lands, even if the lead had previous P1 outcomes — the lead's state moved up.
- A more-specific terminal in the same family (Appointment → Deposit Placed → Purchase Closed) **does** push — that's real progress.
- Task-level-only "Not Connected" outcomes never move the lead state, so they never push.

### Sanity check against Tanessa's contract

> "I want to know every time Emily has contact with one of our customers, sets an appointment, or answers a fresh lead. I do NOT need to be alerted every time she attempts to make contact with someone and is unsuccessful or leaves a voicemail."

- "Every time Emily has contact" → any outcome above P3 → push (first occurrence per lead-tier).
- "Sets an appointment" → Appointment / Service Appointment Booked / Deposit Placed / Purchase Closed → **P0** push.
- "Answers a fresh lead" → lifecycle "Fresh lead" event → **P0** push.
- "Don't alert on unsuccessful attempts / voicemails" → entire Not Connected flat bucket → **P3** suppressed.

The contract maps 1:1 to the priority tiers. There is no outcome in the enum that violates the rule.

---

## 11 · Examples (round-trip the rule against real data)

Sampling from the existing dataset to make this concrete:

| Lead / Customer | Activity | Disposition | Notify? | Rule |
|---|---|---|---|---|
| Casey Strong, +18162884822 | Outbound SMS follow-up, no reply | — | No | §2 row 1 |
| Ayesha Mohammed, +17852171050 | Outbound call → busy | `customer-busy` | No | §1 outbound row 3 |
| Zach Wineinger, +18168964604 (7 activities) | Mix of inbound SMS replies + outbound calls | Multiple | Yes on the inbound SMS replies; No on the outbound voicemails | §2 row 2, §1 outbound row 1 |
| Leslie, +19136057173 | Outbound call → voicemail; action item created | `voicemail` + `actionItem` | Yes (action item only) | §1 outbound row 1 + §3 action item row |
| Unknown caller (575-403-1428) | Inbound call to dealership | Connected to Emily | **Yes — urgent** | §1 inbound row 1 — *this is the case Tanessa explicitly flagged as broken* |

---

_Owner: Dilip / Spyne product · Reviewer: Tanessa Balluch · Linked: `dream_problem_statement.md`_
