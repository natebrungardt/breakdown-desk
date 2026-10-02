"use client";

import type { IncidentView } from "@/lib/types";

// Renders the incident read model (summary, audit trail, actions, records). Sections appear
// as the pipeline reaches their layer. Approve calls /api/actions/[id]/approve via onApprove.
export default function IncidentPanel({
  view,
  layer,
  onApprove,
}: {
  view: IncidentView | null;
  layer: number;
  onApprove: (index: number) => void;
}) {
  if (!view || layer < 1 || view.summary.length === 0) {
    return (
      <div className="status-row" style={{ borderTop: "1px solid var(--rule-dark)", color: "var(--fg-muted)" }}>
        No incident yet.
      </div>
    );
  }

  return (
    <div>
      <div style={{ borderTop: "1px solid var(--rule-dark)" }}>
        {view.summary.map((r) => (
          <div key={r.k} className="status-row">
            <span className="label">{r.k}</span>
            <span className="text">{r.v}</span>
            {r.pill && <span className="pill">{r.pill.toUpperCase()}</span>}
          </div>
        ))}
      </div>

      {view.audit.length > 0 && (
        <>
          <div className="section-label" style={{ margin: "28px 0 0" }}>
            <span>Audit trail</span>
            <span className="line" />
          </div>
          <div>
            {view.audit.map((r, i) => (
              <div key={`${r.k}-${i}`} className="status-row">
                <span className="label" style={{ minWidth: 96 }}>{r.k}</span>
                <span className="text">
                  {r.v}
                  {r.reason && <span style={{ color: "var(--fg-muted)" }}> · {r.reason}</span>}
                </span>
                <span className="pill">
                  {r.needsApproval && <span className="dot" aria-hidden="true" />}
                  {r.needsApproval ? "NEEDS APPROVAL · " : ""}
                  {r.source.toUpperCase()}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {layer >= 4 && view.actions.length > 0 && (
        <>
          <div className="section-label" style={{ margin: "28px 0 0" }}>
            <span>Actions</span>
            <span className="line" />
          </div>
          <div>
            {view.actions.map((a, i) => (
              <div key={a.id ?? a.text} className="status-row">
                <span className="text">
                  {a.text}
                  {a.detail && <div style={{ color: "var(--fg-muted)", fontSize: 13, marginTop: 4 }}>{a.detail}</div>}
                </span>
                <span className="pill">
                  {!a.approved && <span className="dot" aria-hidden="true" />}
                  {a.approved ? "APPROVED" : "PENDING"}
                </span>
                {!a.approved && (
                  <button type="button" className="btn btn-primary btn-sm" onClick={() => onApprove(i)}>
                    Approve
                  </button>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {layer >= 5 && view.records.length > 0 && (
        <>
          <div className="section-label" style={{ margin: "28px 0 0" }}>
            <span>Records</span>
            <span className="line" />
          </div>
          <div>
            {view.records.map((r) => (
              <div key={r.k} className="status-row">
                <span className="label" style={{ minWidth: 96 }}>{r.k}</span>
                <span className="text">{r.v}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
