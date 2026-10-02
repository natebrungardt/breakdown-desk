# Breakdown Desk

A small demo of an AI decision layer for truck breakdowns.

When a truck throws a fault code, Breakdown Desk:

1. **Normalizes the alert.** Geotab, Samsara and driver-SMS payloads become one `FaultEvent`.
2. **Looks up the truck.** It finds the unit, its current load and delivery deadline, and its warranty coverage.
3. **Decides.** It sets severity (`stop_now` / `limp_to_shop` / `schedule_later`), decides whether a tow is needed, picks the shops to ask and checks whether the repair is recoverable under warranty.
4. **Acts.** It calls the capable shops for quotes.
5. **Works with counterparties.** Mock shops along I-80 answer in parallel, the best quote is accepted, and a shop booking, driver SMS and warranty claim are drafted for each party, held for human approval when needed.
6. **Writes records.** It saves a repair order and a claim line, plus an audit row for every decision.

Every step streams live to a dashboard through Supabase Realtime.

## Architecture

Six layers, run in order by [`lib/pipeline.ts`](lib/pipeline.ts), following Elmeeda's ontology:

```
Signals → Units → Decisions → Actions → Counterparties → Records
```

| Layer | Code | What it does |
|---|---|---|
| Signals | `app/api/signals/[source]`, `lib/adapters/*` | Webhook per source (`geotab`, `samsara`, `driver`) → `FaultEvent` |
| Units | `lib/units.ts` | Truck, current load, warranty coverage |
| Decisions | `lib/decisions/*` | Severity, tow need, shop set, warranty recoverability |
| Actions | `lib/pipeline.ts` | Call capable shops for quotes |
| Counterparties | `lib/counterparties.ts`, `lib/actions.ts` | Shops answer in parallel, `quote_accept`, then templated booking, driver SMS and warranty claim (`pending`) |
| Records | `lib/records.ts` | Repair order and claim line (stand-in for the fleet's maintenance system or TMS) |

### Severity triage

The core logic is in [`lib/decisions/severity.ts`](lib/decisions/severity.ts):

- **Hard rules first.** Clear safety cases (critical oil pressure, severe coolant temp, brake failure) go straight to `stop_now`. The LLM is not called.
- **LLM for gray areas.** For ambiguous faults the rules set a minimum floor and the LLM classifies the fault with a confidence score. The final severity is the more severe of the two, so the LLM can escalate but never downgrade.
- **Human in the loop.** Any `stop_now` result, or an LLM confidence below 0.7, is marked as needing approval.
- **Fallback.** If the LLM is unavailable, the rule floor is used and the decision goes to a human.
- **Unknowns fail safe.** A fault the rules can't classify floors at `limp_to_shop`, so it is never auto-approved. A driver report with no milepost stops before shop selection and asks dispatch to confirm the location instead of guessing one.
- **Audit.** Each decision row records its source (`rule`, `llm` or `human`), its reason and its inputs.

[`lib/llm.ts`](lib/llm.ts) is the only file that calls an AI provider (OpenAI, structured JSON output). Everything else is rules and templates.

### Demo scenarios

| Button | Source | Expected path |
|---|---|---|
| Oil pressure critical | Geotab | Rule → `stop_now`, tow, needs approval |
| DPF warning | Samsara | LLM → `limp_to_shop`, under warranty → OEM dealer |
| Slow tire leak | Driver SMS | `schedule_later`, auto-approved |

## Stack

Next.js (App Router) + TypeScript + Tailwind, Supabase (Postgres + Realtime), OpenAI SDK, deployed on Vercel. No orchestration framework. No user login (see [Security notes](#security-notes)).

## Running locally

### Prerequisites

- Node.js 20+
- A Supabase project (the free tier is fine)
- An OpenAI API key. This one is optional: without it, ambiguous faults fall back to the rule floor and go to approval.

### 1. Install

```bash
npm install
```

### 2. Set up the database

In the Supabase dashboard, open **SQL Editor** and run these two files in order:

1. [`supabase/schema.sql`](supabase/schema.sql) creates the tables, the security settings and the Realtime publication for `incident_events`.
2. [`supabase/seed.sql`](supabase/seed.sql) adds the trucks, the shops along I-80, the warranty policies and the loads.

`schema.sql` drops and recreates its tables, so you can re-run both files to reset everything.

### 3. Configure environment

```bash
cp .env.example .env.local
```

Then fill in `.env.local`:

| Variable | Where to find it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Same page (anon / public key). The browser uses it to subscribe to the live feed. |
| `SUPABASE_SERVICE_ROLE_KEY` | Same page (service role). **Server only. Never expose it.** |
| `OPENAI_API_KEY` | platform.openai.com |
| `OPENAI_MODEL` | Optional. Defaults to `gpt-4o-mini`. |
| `SIGNALS_WEBHOOK_SECRET` | Any long random string, e.g. `openssl rand -hex 32`. Required to call `/api/signals/*`; the webhook rejects every call while it is unset. |

### 4. Run

```bash
npm run dev
```

Open http://localhost:3000 and click a scenario button. The layer bar and the live feed fill in as the pipeline runs (with about 400 ms between steps so it stays readable). Approve pending actions from the incident panel. **Reset** clears incidents but keeps the reference data.

### Sending a signal by hand

The scenario buttons replay fixed payloads through `/api/scenarios/[id]`. To send your own payload, call the webhook with the shared secret:

```bash
curl -X POST http://localhost:3000/api/signals/driver -H 'content-type: application/json' -H "x-webhook-secret: $SIGNALS_WEBHOOK_SECRET" -d '{"channel":"sms","receivedAt":"2026-10-02T03:02:16Z","driver":{"name":"Marcus Hale"},"unitNumber":"4590","message":"Left rear drive tire is losing air slowly, about 3 psi an hour. Still rolling fine on I-80 E near MP 284."}'
```

The call returns `202 { incidentId }` right away, and the pipeline keeps running in the background. See [`lib/mockPayloads.ts`](lib/mockPayloads.ts) for example Geotab and Samsara payloads.

## API

| Method | Route | Purpose |
|---|---|---|
| `POST` | `/api/signals/[source]` | Ingest a fault (`geotab`, `samsara` or `driver`). Needs the `x-webhook-secret` header |
| `POST` | `/api/scenarios/[id]` | Run one of the three demo scenarios (`oil`, `dpf`, `tire`) from the dashboard |
| `GET` | `/api/incidents/[id]` | Incident with its truck, load, decisions, actions, records and events |
| `POST` | `/api/actions/[id]/approve` | Human approval of a pending action |
| `POST` | `/api/reset` | Clear runtime data |

## Security notes

This is a demo, and these are the trade-offs made on purpose:

- **Keys.** The Supabase service-role key and the OpenAI key are read only in server code. The browser gets the anon key, and row-level security lets it read `incident_events` (the live feed) and nothing else.
- **Webhook.** `/api/signals/*` accepts arbitrary payloads, so it requires a shared secret (`x-webhook-secret`) and fails closed when none is configured.
- **Dashboard routes.** The scenario buttons, Approve and Reset are open so the demo works without a login. Scenarios can only replay the three fixed payloads, and every run counts toward a cap of 20 incidents per 10 minutes, which bounds LLM spend. Anyone with the URL can still approve an action or reset the demo. A real deployment would put the dashboard and these routes behind the fleet's SSO and record who approved each action.
- **AI limits.** The LLM only classifies severity. It can escalate past the rule floor but never lower it, and it never writes messages or picks shops.

## Simplifications

- Distance is straight-line (haversine) from lat/lng. No maps API.
- Shop quotes are mocked, with short random delays.
- Messages come from templates, not the LLM.
- Vendor payloads are mocked, but the adapter code that parses them is real.

## Deploying

The app deploys to Vercel as a standard Next.js app. Set the same environment variables in the Vercel project settings.
