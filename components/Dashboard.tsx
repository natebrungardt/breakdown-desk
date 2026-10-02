"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildPayload } from "@/lib/mockPayloads";
import { SCENARIOS, scenarioToView, type Scenario } from "@/lib/mockScenarios";
import { browserClient } from "@/lib/supabaseBrowser";
import { LAYER_ORDER, type FeedEvent, type IncidentView } from "@/lib/types";
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
  const [view, setView] = useState<IncidentView | null>(null);
  const [offlineApproved, setOfflineApproved] = useState<Set<number>>(new Set());
  const [resetting, setResetting] = useState(false);
  const runId = useRef(0);
  const activeIncident = useRef<string | null>(null);
  // Actions approved on screen whose POST has not finished yet; refreshes keep them approved.
  const approving = useRef<Set<string>>(new Set());

  // Incident panel data: refetch whenever a new event arrives for the active incident, plus a
  // slow poll while it runs (also merges events, as a safety net if Realtime drops).
  const refreshView = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/incidents/${id}`, { cache: "no-store" });
      if (!res.ok) return;
      const data: { view: IncidentView; events: FeedEvent[] } = await res.json();
      // The user may have switched scenarios while this was in flight; drop stale replies.
      if (activeIncident.current !== id) return;
      setView(withApproving(data.view, approving.current));
      setEvents((prev) => {
        const known = new Set(prev.map((e) => e.id));
        const missing = data.events.filter((e) => !known.has(e.id));
        return missing.length ? [...missing, ...prev] : prev;
      });
      if (data.view.status !== "open") setComplete(true);
    } catch {
      /* transient; the next event or poll retries */
    }
  }, []);

  // Subscribe once; keep every incident_events row so none are lost before the POST returns an id.
  useEffect(() => {
    const sb = browserClient();
    if (!sb) return;
    const channel = sb
      .channel("incident_events")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "incident_events" }, (msg) => {
        const row = msg.new as FeedEvent;
        setEvents((prev) => (prev.some((e) => e.id === row.id) ? prev : [row, ...prev]));
        if (row.incident_id !== activeIncident.current) return; // an earlier run still finishing in the background
        if (row.layer === "records") setComplete(true);
        void refreshView(row.incident_id);
      })
      .subscribe();
    return () => {
      sb.removeChannel(channel);
    };
  }, [refreshView]);

  const mine = useMemo(() => events.filter((e) => e.incident_id === incidentId), [events, incidentId]);

  useEffect(() => {
    if (!incidentId || offline || complete) return;
    const t = setInterval(() => void refreshView(incidentId), 2000);
    return () => clearInterval(t);
  }, [incidentId, offline, complete, refreshView]);

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

  async function reset() {
    runId.current++;
    activeIncident.current = null;
    setActive(null);
    setIncidentId(null);
    setEvents([]);
    setComplete(false);
    setOffline(false);
    setOfflineLayer(-1);
    setView(null);
    // Reset deletes every incident, so no new run may start until it is done,
    // or the delete could wipe the new incident mid-pipeline.
    setResetting(true);
    try {
      await fetch("/api/reset", { method: "POST" });
    } catch {
      /* offline: nothing to clear */
    } finally {
      setResetting(false);
    }
  }

  async function approve(index: number) {
    if (offline) {
      setOfflineApproved((prev) => new Set(prev).add(index));
      return;
    }
    const id = view?.actions[index]?.id;
    if (!id || !incidentId) return;
    // Show it approved right away; the server round trips take about a second.
    approving.current.add(id);
    setView((v) => v && withApproving(v, approving.current));
    try {
      const res = await fetch(`/api/actions/${id}/approve`, { method: "POST" });
      if (!res.ok) throw new Error(`approve API ${res.status}`);
    } catch (err) {
      console.warn("approve failed:", err);
    } finally {
      approving.current.delete(id);
      // Confirms the approval, or puts the action back to pending if it failed.
      await refreshView(incidentId);
    }
  }

  async function run(s: Scenario) {
    const id = ++runId.current;
    activeIncident.current = null;
    setActive(s);
    setEvents([]);
    setComplete(false);
    setIncidentId(null);
    setOffline(false);
    setOfflineLayer(-1);
    setView(null);
    setOfflineApproved(new Set());
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
      if (runId.current === id) {
        activeIncident.current = newId;
        setIncidentId(newId);
        void refreshView(newId);
      }
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
            <ScenarioButtons scenarios={SCENARIOS} activeId={active?.id ?? null} onRun={run} onReset={reset} disabled={resetting} />
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
            <IncidentPanel view={offline && active ? scenarioToView(active, offlineApproved) : view} layer={layer} onApprove={approve} />
          </div>
        </div>
      </section>
    </main>
  );
}

function withApproving(view: IncidentView, ids: Set<string>): IncidentView {
  if (!ids.size) return view;
  return { ...view, actions: view.actions.map((a) => (a.id && ids.has(a.id) ? { ...a, approved: true } : a)) };
}
