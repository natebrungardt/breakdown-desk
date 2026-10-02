# Breakdown Desk

A small demo of an AI decision layer for truck breakdowns. When a truck throws a fault code, the system normalizes the alert, looks up the truck's context, decides severity / tow / shop / warranty, gathers mock shop quotes, drafts actions for approval, and writes records plus an audit trail. Every step streams live to a dashboard.

Purpose: a 2–3 minute live demo in an interview for a Forward-Deployed Engineer role at a fleet-maintenance AI startup. It must be small, working, deployed and easy to explain. Favor clarity and reliability over features.

## Stack

- Next.js (App Router) + TypeScript + Tailwind
- Supabase (Postgres + Realtime) — service key used in server code only
- OpenAI SDK with structured outputs (JSON schema) — used ONLY for severity triage
- Deployed on Vercel
- No auth. No LangChain or other orchestration frameworks.

## Architecture: six layers

Signals → Units → Decisions → Actions → Counterparties → Records

```
/app
  page.tsx                          dashboard (scenario buttons, layer bar, live feed, incident panel)
  /api/signals/[source]/route.ts    webhook; source = geotab | samsara | driver
  /api/actions/[id]/approve/route.ts  human approval of a pending action
/lib
  /adapters/geotab.ts, samsara.ts   vendor payload -> one FaultEvent type
  units.ts                          resolve truck, current load, warranty coverage
  /decisions/
    severity.ts                     rules first, LLM for gray areas, take the more severe, flag for approval
    towNeed.ts                      stop_now => tow needed
    shopSet.ts                      filter by capability, rank by distance, prefer OEM dealer if under warranty
    recoverable.ts                  is the component under warranty (mileage/age)?
  counterparties.ts                 mock shops return quotes in parallel with short random delays
  actions.ts                        template-drafted shop booking, driver SMS, warranty claim (status: pending)
  records.ts                        repair order + claim line (stand-in for writing to fleet's maintenance system / TMS)
  events.ts                         emit(incidentId, layer, status, message) -> insert into incident_events
  pipeline.ts                       runs all layers in order
  llm.ts                            the only file that calls the AI provider; exports triage()
/components  LayerBar, EventFeed, IncidentPanel, ScenarioButtons
/supabase    schema.sql, seed.sql
```

Keep API routes thin; business logic lives in /lib.

## Database

- Reference: `trucks`, `shops`, `warranty_policies`, `loads`
- `incidents` — one per breakdown
- `incident_events` — the live feed (Realtime enabled): incident_id, created_at, layer, status, message
- `decisions` — the audit trail: incident_id, decision name, output, source (`rule` | `llm` | `human`), reason, inputs (jsonb)
- `actions` — type, recipient, body, status (`pending` | `approved`)
- `records` — type (`repair_order` | `claim_line`), payload (jsonb)

## Severity logic (the most important file)

1. Hard rules run first and win for clear safety cases (critical oil pressure, severe coolant temp, brake failure) => `stop_now`, source `rule`, LLM not called.
2. For ambiguous faults, rules set a minimum floor; the LLM classifies `stop_now | limp_to_shop | schedule_later` with confidence and reason. Final severity = the more severe of floor and LLM. The LLM can escalate, never downgrade.
3. Low confidence (< 0.7) or `stop_now` => decision marked needs approval.
4. Every decision row records its source.

## Seed data

- ~10 trucks (unit numbers like 3847, make/model/year, odometer, in-service date)
- ~15 shops along I-80 between Omaha, Chicago and Denver: mix of OEM dealers, independents and tire shops, with lat/lng, capabilities, in-network flag, labor rate
- Warranty policies by component (engine, aftertreatment, drivetrain, tires) with mileage/age limits
- A current load per truck (customer, delivery deadline)
- Realistic fault codes (J1939 SPN/FMI): oil pressure, coolant temp, DPF differential pressure, tire pressure
- Specific locations like "I-80 W, MP 213"

## Demo scenarios (one button each)

1. Oil pressure critical (Geotab payload) — rule => stop_now, tow, needs approval
2. DPF warning (Samsara payload) — LLM => limp_to_shop, under warranty => OEM dealer
3. Slow tire leak (driver message) — schedule_later, auto-approved

Brief pauses (~400ms) between pipeline steps so the feed is readable.

## Style

Matches elmeeda.com so the demo feels native to the company. `app/globals.css` is the reference stylesheet copied unchanged, with a clearly marked "Breakdown Desk additions" block at the bottom. Do not edit the reference part; add new rules in the additions block.

Dark minimal ops dashboard: #0A0A0A background, #111110 panels, 1px #1E1E1C / #2A2A28 rules, no shadows, square or 4px corners. Warm off-white text (#E6E6E0, headings #FAFAF7), muted gray #8A8A85. One orange accent #E5541C for live/active states only. Small uppercase tracked status labels (ROUTING, LIVE, BOOKED). UTC timestamps (03:02:16Z) with tabular numerals. Heavy (600) tight-tracked headings. Font: General Sans, loaded from Fontshare in `app/layout.tsx` (no Geist). Rows separated by thin lines; tables over cards. Use the reference classes (`wrap`, `section-label`, `two-col`, `verbs`, `status-row`, `ticker-shell`, `tk-row`, `btn`). Original wordmark and mark: do not use Elmeeda's logo or name.

## Simplifications

- Distance: straight-line (haversine) from lat/lng, no maps
- Messages from templates, not the LLM
- Mock payloads, real adapter code

## Cut order if behind

Layer bar → towNeed → Approve button. Never cut: live feed, severity triage, audit trail.

## Current phase

Build the full pipeline.

@AGENTS.md
