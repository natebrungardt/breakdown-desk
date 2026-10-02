import type { FeedEvent } from "./Dashboard";

// Draft: rows arrive as props from the browser-side simulation.
// Tomorrow this subscribes to incident_events via Supabase Realtime.
export default function EventFeed({ events, running }: { events: FeedEvent[]; running: boolean }) {
  return (
    <div className="ticker-shell" style={{ marginTop: 0 }} aria-label="Live event feed">
      <div className="ticker-head">
        <span className="lv">
          <span className="dot" style={running ? undefined : { animation: "none", opacity: 0.4 }} />
          {running ? "LIVE" : "IDLE"} · incident feed
        </span>
        <span>breakdown.events</span>
      </div>
      <div id="ticker-feed" role="log" aria-live="polite" style={{ minHeight: 360 }}>
        {events.length === 0 && (
          <div className="tk-row" style={{ gridTemplateColumns: "1fr" }}>
            <span className="tk-txt" style={{ color: "var(--fg-muted)" }}>
              Pick a scenario above to send a mock alert through the pipeline.
            </span>
          </div>
        )}
        {events.map((e) => (
          <div key={e.id} className="tk-row enter">
            <span className="tk-ts">{e.ts}</span>
            <span className={`tk-state tk-state-${e.state}`}>
              <span className="tk-dot" />
              {e.state.toUpperCase()}
            </span>
            <span className="tk-txt">{e.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
