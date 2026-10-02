import type { FeedEvent } from "@/lib/types";

// Rows come from incident_events (Supabase Realtime), newest first.
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
        {[...events].sort((a, b) => b.id - a.id).map((e) => (
          <div key={e.id} className="tk-row enter">
            <span className="tk-ts">{e.created_at.slice(11, 19)}Z</span>
            <span className={`tk-state tk-state-${e.status}`}>
              <span className="tk-dot" />
              {e.status.toUpperCase()}
            </span>
            <span className="tk-txt">{e.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
