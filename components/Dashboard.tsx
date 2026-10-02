"use client";

import { useRef, useState } from "react";
import { SCENARIOS, type FeedState, type Scenario } from "@/lib/mockScenarios";
import EventFeed from "./EventFeed";
import IncidentPanel from "./IncidentPanel";
import LayerBar from "./LayerBar";
import ScenarioButtons from "./ScenarioButtons";

export type FeedEvent = { id: number; ts: string; state: FeedState; text: string };

const PAUSE_MS = 400;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const utcNow = () => new Date().toISOString().slice(11, 19) + "Z";

// Draft: simulates the pipeline in the browser. Tomorrow: POST /api/signals/[source],
// and EventFeed subscribes to incident_events instead of receiving props.
export default function Dashboard() {
  const [active, setActive] = useState<Scenario | null>(null);
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [layer, setLayer] = useState(-1); // layer currently running; 6 = finished
  const [runKey, setRunKey] = useState(0);
  const runId = useRef(0);

  async function run(s: Scenario) {
    const id = ++runId.current;
    setActive(s);
    setEvents([]);
    setLayer(0);
    setRunKey((k) => k + 1);
    for (let i = 0; i < s.steps.length; i++) {
      if (i > 0) await sleep(PAUSE_MS);
      if (runId.current !== id) return;
      const step = s.steps[i];
      setLayer(step.layer);
      setEvents((prev) => [{ id: i, ts: utcNow(), state: step.state, text: step.text }, ...prev]);
    }
    await sleep(PAUSE_MS);
    if (runId.current === id) setLayer(6);
  }

  return (
    <main id="main">
      <section className="hero compact">
        <div className="wrap">
          <div className="dash-head">
            <div>
              <div className="eyebrow">
                <span className="dot" aria-hidden="true" />
                <span>Draft · sample data</span>
              </div>
              <h1 className="display">Breakdown Desk.</h1>
            </div>
            <ScenarioButtons scenarios={SCENARIOS} activeId={active?.id ?? null} onRun={run} />
          </div>
        </div>
      </section>

      <section className="block tight">
        <div className="wrap">
          <LayerBar current={layer} />
        </div>
      </section>

      <section className="block tight">
        <div className="wrap dash">
          <div>
            <div className="section-label" style={{ marginBottom: 16 }}>
              <span>Live feed</span>
              <span className="line" />
            </div>
            <EventFeed events={events} running={layer >= 0 && layer < 6} />
          </div>
          <div>
            <div className="section-label" style={{ marginBottom: 16 }}>
              <span>Incident</span>
              <span className="line" />
            </div>
            <IncidentPanel key={runKey} scenario={active} layer={layer} />
          </div>
        </div>
      </section>
    </main>
  );
}
