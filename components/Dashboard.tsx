"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { buildPayload } from "@/lib/mockPayloads";
import { SCENARIOS, type Scenario } from "@/lib/mockScenarios";
import { browserClient } from "@/lib/supabaseBrowser";
import { LAYER_ORDER, type FeedEvent } from "@/lib/types";
import EventFeed from "./EventFeed";
import IncidentPanel from "./IncidentPanel";
import LayerBar from "./LayerBar";
import ScenarioButtons from "./ScenarioButtons";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Live mode: POST the scenario's mock payload to /api/signals/[source]; the feed is
// incident_events streamed over Supabase Realtime.
// Offline fallback: if the API or Supabase is unreachable, replay the canned
// scenario from mockScenarios.ts in the browser.
export default function Dashboard() {
  const [active, setActive] = useState<Scenario | null>(null);
  const [incidentId, setIncidentId] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [events, setEvents] = useState<FeedEvent[]>([]); // all realtime rows, newest first
  const [complete, setComplete] = useState(false);
  const [offlineLayer, setOfflineLayer] = useState(-1);
  const runId = useRef(0);

  // Subscribe once; keep every incident_events row so none are lost before the POST returns an id.
  useEffect(() => {
    const sb = browserClient();
    if (!sb) return;
    const channel = sb
      .channel("incident_events")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "incident_events" }, (msg) => {
        const row = msg.new as FeedEvent;
        setEvents((prev) => (prev.some((e) => e.id === row.id) ? prev : [row, ...prev]));
        if (row.layer === "records") setComplete(true);
      })
      .subscribe();
    return () => {
      sb.removeChannel(channel);
    };
  }, []);

  const mine = useMemo(() => events.filter((e) => e.incident_id === incidentId), [events, incidentId]);

  const layer = offline
    ? offlineLayer
    : incidentId === null
      ? -1
      : complete
        ? 6
        : Math.max(0, ...mine.map((e) => LAYER_ORDER.indexOf(e.layer)));

  async function runOffline(s: Scenario, id: number) {
    setOffline(true);
    setOfflineLayer(0);
    const rows: FeedEvent[] = [];
    for (let i = 0; i < s.steps.length; i++) {
      if (i > 0) await sleep(400);
      if (runId.current !== id) return;
      const st = s.steps[i];
      setOfflineLayer(st.layer);
      rows.unshift({
        id: i,
        incident_id: "offline",
        created_at: new Date().toISOString(),
        layer: LAYER_ORDER[st.layer],
        status: st.state,
        message: st.text,
      });
      setEvents([...rows]);
    }
    await sleep(400);
    if (runId.current === id) setOfflineLayer(6);
  }

  async function run(s: Scenario) {
    const id = ++runId.current;
    setActive(s);
    setEvents([]);
    setComplete(false);
    setIncidentId(null);
    setOffline(false);
    setOfflineLayer(-1);
    const scenario = buildPayload(s.id);
    try {
      if (!browserClient() || !scenario) throw new Error("live mode unavailable");
      const res = await fetch(`/api/signals/${scenario.source}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(scenario.payload),
      });
      if (!res.ok) throw new Error(`signals API ${res.status}`);
      const { incidentId: newId } = await res.json();
      if (runId.current === id) setIncidentId(newId);
    } catch (err) {
      console.warn("falling back to offline scenario:", err);
      await runOffline(s, id);
    }
  }

  return (
    <main id="main">
      <section className="hero compact">
        <div className="wrap">
          <div className="dash-head">
            <div>
              <div className="eyebrow">
                <span className="dot" aria-hidden="true" />
                <span>{offline ? "Offline · sample data" : "Live · Supabase Realtime"}</span>
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
            <EventFeed events={offline ? events : mine} running={layer >= 0 && layer < 6} />
          </div>
          <div>
            <div className="section-label" style={{ marginBottom: 16 }}>
              <span>Incident</span>
              <span className="line" />
            </div>
            <IncidentPanel key={String(incidentId ?? active?.id)} scenario={offline ? active : null} layer={layer} />
          </div>
        </div>
      </section>
    </main>
  );
}
