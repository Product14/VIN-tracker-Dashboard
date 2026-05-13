# Dream Automotive — Lead Visibility & Notifications

**Client:** Dream Automotive — 3 rooftops (Lawrence · Legends · Midwest)
**Agent:** Emily Carter (Spyne AI) · CRM: ProMax
**Goal:** show the dealership what Emily does with their customers, in real time, without spam.

---

## The contract

Tanessa Balluch, 5/8:

> "I want to know every time Emily has contact with one of our customers, sets an appointment, or answers a fresh lead. I do NOT need to be alerted every time she attempts to make contact with someone and is unsuccessful or leaves a voicemail."

That one sentence is the requirement. Everything below implements it.

---

## How we model it

A **lead** is a customer record. Each lead has many **activities** (calls, SMS); each conversation produces an **outcome** classified from a closed enum (Appointment · Pricing Inquiry · Not Interested · Voicemail · etc — see `outcomes.md`). Activities tell us *what occurred*; outcomes tell us *what it meant*. We notify on outcomes, not on raw events.

Outcomes are layered: lead-level sticks (terminal absorbs · tier 2 > tier 1 · latest wins same-tier), task-level is per conversation. "Not Connected" outcomes (voicemail, busy, no-answer) are task-level only — they never become the lead's state and therefore never push.

---

## The rule

Push a notification when the **lead's state moves up the priority ladder**. Stay silent on the attempts beneath that.

| Priority | Channel | Latency | Triggers |
|---|---|---|---|
| **P0 · Urgent** | Real-time push (SMS / Slack / email) | < 30 s | Fresh inbound lead · Appointment / Deposit / Purchase · Live human transfer · Customer asks for human · Compliance (STOP, Do Not Call, Opt Out) |
| **P1 · Standard** | Default real-time channel | < 2 min | Commercial interest (Pricing / Financing / Trade / Ancillary / Vehicle Inquiry) · Permanent disqualification (Not Interested, Wrong Number, Already Purchased) |
| **P2 · Dashboard** | Live feed only — no push | n/a | Shallow engagement (Operating Hours, Soft Decline, General Engagement, Could Not Conclude) |
| **P3 · Suppressed** | Internal log only | n/a | Voicemail · Busy · No-answer · Twilio failure · Outbound SMS with no reply · SMS undelivered |

P3 is exactly what Tanessa asked to suppress; P0 + P1 is exactly what she asked to surface. P2 is what she said was fine to *see but not be paged on*.

---

## Live SMS conversations — the "no edit" rule

Push notifications can't be edited after they fire, so during a live back-and-forth we don't push per message — we push on **state transitions**:

- **First customer reply** → one push: "{customer} is replying to Emily."
- **Intent escalation** mid-conversation (price asked, vehicle asked, asks-for-human, STOP, rage-quit) → one push per signal.
- **Appointment scheduled** → P0 push.
- **Conversation idle ≥ 10 min** → close in dashboard, no push.
- **Customer replies after that idle** → new "conversation resumed" push.

A typical six-message conversation produces one to three pushes, not six. The dashboard handles the in-between detail.

---

## Dashboard vs push

Two layers, doing different jobs:

- **Dashboard at `/dream`** — always-on view, auto-refreshes every 60 s. Three rooftop tabs (Lawrence · Legends · Midwest). Every activity lands here; sortable by recency, activities, outcome. The source of truth for "what's the full picture right now."

- **Push notifications** — for "stop what you're doing." Sent only on priority-mapped events above. Each push carries customer name + phone, source + rooftop, the trigger event, a one-line summary, and a deep link back to the lead in the dashboard.

Together: push tells the dealer *something happened*; dashboard shows them *everything, kept current*.

---

## Configurability

Per-rooftop defaults, overridable per dealer:

- **Push channels** — SMS / email / Slack (each dealer picks)
- **Verbosity** — P0 only / P0+P1 / all qualifying (Dream default: P0+P1)
- **Quiet hours** — Dream: none
- **Per-CRM mapping** — which priority tiers also push *into the CRM* vs stay in the dashboard. Governed centrally, not in code.

---

## Hallucination guard

The outcome enum is closed. Classification rejects any value not in the enum at the tool boundary. Every notification is a table lookup from outcome → priority — the agent cannot invent a trigger, rename one, or free-text its way to a push.

---

## Status

- [x] Lead-activity dashboard live at `/dream` — 2,069 leads · 8,500 activities · 3 rooftops · sortable · auto-refresh
- [x] Outcome enum defined and closed (`outcomes.md`)
- [ ] Priority-mapped push notification triggers (this spec)
- [ ] Per-dealer / per-CRM configuration UI
- [ ] Test-recordings workflow so Dream can verify each fix without deleting customer numbers

---

_Linked: `outcomes.md` (closed enum) · `/dream` dashboard · 5/8 meeting transcript · Tanessa's 5/8 follow-up email._
