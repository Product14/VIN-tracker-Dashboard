# Dream Automotive — Problem Statement

**Client:** Dream Automotive (3 rooftops: Lawrence, Legends, Midwest)
**Counterparts:** Tanessa Balluch, Anne Kelley
**System:** Spyne AI sales agent ("Emily Carter") · integration with ProMax CRM
**Date:** 2026-05-11

---

## The problem in one sentence

The dealership cannot see what their AI sales agent is doing with their customers, and several of the things she **is** doing are damaging their reputation — so they have no way to catch issues, and no confidence in the system they've already paid for.

## What the client is asking for (verbatim, from Tanessa's 5/8 email)

> "I want to know every time Emily has contact with one of our customers, sets an appointment, or answers a fresh lead. I do NOT need to be alerted every time she attempts to make contact with someone and is unsuccessful or leaves a voicemail."

That single sentence is the contract. Everything else flows from it.

## Specific issues raised (open, urgent)

| # | Issue | Why it matters | Status |
|---|---|---|---|
| 1 | **Inbound calls to Emily produce no lead / no notification** to the dealership (e.g. 575-403-1428, 618-917-3695, 785-329-4511). | Lost car deals. The dealership has no idea a customer called. | Spyne: integration completed 30-Apr; older cases pre-date that. Tanessa: "still an issue" — needs verification. |
| 2 | **Emily tells customers a vehicle is "no longer available" / "sold"** on follow-up SMS when there has been no prior contact and the vehicle is still in inventory. | Confuses live shoppers; destroys credibility on the dealership's own inventory. | Open — 136 confirmed cases in the data over the dataset window. |
| 3 | **Emily proactively offers Out-The-Door pricing**, sometimes after an appointment is already set. | Skips the sales team's chance to build the relationship and close. Customer walks away with the number, never comes in. | Open — Spyne building a "price range" replacement; no rollout date. |
| 4 | **Duplicate action-item suppression** silently filters repeat customer requests (e.g. Korayma Ojedis — DNKC). | Real escalations get hidden. Tanessa: "I find it interesting that you think it is more important to flood my team with duplicate leads on outbound calls with no contact, but not when a customer starts up another conversation." | Spyne: working as designed. Client: **"I want this fixed immediately."** Disagreement is on principle, not bug. |
| 5 | **Appointment Confirmation SMS cadence** (per Chin) | Dream-specific request. | New — needs scope. |
| 6 | **Client can't independently verify fixes** because customer phone numbers cannot be deleted (compliance), so they can't simulate a "new customer" experience. | No trust without proof. | Open — Spyne to send test recordings as interim verification. |

## Why these aren't just "bugs" — what the design needs

From the whiteboard work:

### Lead lifecycle as a first-class concept
Today the system reports activity in scattered, inconsistent ways. We need a defined **lead lifecycle event model**:
- **Events to define:** Lead Created · Status Update · Inbound Lead Alert · New info in SMS · Activity (with timestamp + source) · Action Item Created · Appointment Made
- **Value pairs to define:** what data ships with each event
- **CRM mapping:** which events are pushed to which CRM, governed centrally — not implicit in code

### Configurability per CRM and per dealer
- **Per-CRM toggle** (e.g. ProMax: Yes/No on push)
- **Per-dealer surfacing levels** (Dealer A gets full info, Dealer B gets limited info) — Dream wants more than the current default; future dealers may want less
- Source-of-truth for these settings is configuration, not deploy

### Notification contract (the asymmetry Tanessa is calling out)
The current notification logic is **"notify when an action is taken or appointment is booked."** The client wants this inverted:

- **Always notify on:** any customer-initiated contact · any appointment set · any new lead answered · status changes · meaningful action items (even when repeated)
- **Never notify on:** outbound attempts that hit voicemail / no-answer / busy
- This is configurable per-dealer, but the default needs to flip.

## Out of scope (explicit, so we don't drift)

- Emily's underlying conversation model tuning (Spyne owns; outside this dashboard)
- ProMax CRM API ergonomics (we honor what it allows)
- Historical phone-number deletion (blocked by compliance)

## Success criteria

We're done when Tanessa stops needing to send emails like the 5/8 one — i.e.:

1. Zero "I didn't know Emily talked to this customer" complaints
2. Zero "Emily told the customer the wrong thing" incidents in the inventory-accurate cases
3. The team can independently verify behavior changes (test environment, recordings, or both)
4. Pricing / sold-vehicle / duplicate-action-item behaviors match what Dream explicitly asked for, not what the system defaulted to

## Immediate next moves (this week)

1. **Visibility (this PR):** ship the lead-activity dashboard so Dream — and we — can see every Emily touch in near-real-time, filterable per rooftop. _(Live at `/dream`; covers 2,069 leads / 8,500 activities across the three rooftops.)_
2. **Notification triggers:** wire the "any inbound contact / fresh-lead-answered / appointment-set" alerts. Default off the voicemail noise.
3. **False-sold messaging:** patch the follow-up cadence so Emily never volunteers "vehicle is sold" without a customer query first.
4. **Out-the-door pricing:** remove the proactive offer from the conversation flow; ship the price-range replacement.
5. **Action-item dedup logic:** change from "suppress duplicates always" to "suppress within a short window, escalate on persistence" — exact policy to be defined with Tanessa.
6. **Test-recordings workflow:** Spyne to record internal verifications and share with Dream after each fix, since deletion isn't an option.

---

_Source material: meeting transcript with Dilip / Tanessa / Anne / Jaspreet (recorded), Tanessa Balluch's 5/8 follow-up email, whiteboard notes (lead lifecycle + per-dealer configurability)._
