"use client";

import { useState } from "react";
import type { Scenario } from "@/lib/mockScenarios";

// Draft: reads sample data from the active scenario. Sections appear as the pipeline reaches them.
// Tomorrow this reads incidents, decisions and actions from Supabase, and Approve hits
// /api/actions/[id]/approve.
export default function IncidentPanel({ scenario, layer }: { scenario: Scenario | null; layer: number }) {
  const [approved, setApproved] = useState<Set<number>>(new Set());

  if (!scenario || layer < 1) {
    return (
      <div className="status-row" style={{ borderTop: "1px solid var(--rule-dark)", color: "var(--fg-muted)" }}>
        No incident yet.
      </div>
    );
  }

  return (
    <div>
      <div style={{ borderTop: "1px solid var(--rule-dark)" }}>
        {scenario.summary.map((r) => (
          <div key={r.k} className="status-row">
            <span className="label">{r.k}</span>
            <span className="text">{r.v}</span>
            {r.pill && <span className="pill">{r.pill}</span>}
          </div>
        ))}
      </div>

      {layer >= 2 && (
        <>
          <div className="section-label" style={{ margin: "28px 0 0" }}>
            <span>Audit trail</span>
            <span className="line" />
          </div>
          <div>
            {scenario.audit.map((r) => (
              <div key={r.k} className="status-row">
                <span className="label" style={{ minWidth: 96 }}>{r.k}</span>
                <span className="text">
                  {r.v}
                  <span style={{ color: "var(--fg-muted)" }}> · {r.reason}</span>
                </span>
                <span className="pill">{r.source.toUpperCase()}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {layer >= 4 && (
        <>
          <div className="section-label" style={{ margin: "28px 0 0" }}>
            <span>Actions</span>
            <span className="line" />
          </div>
          <div>
            {scenario.actions.map((a, i) => {
              const done = a.approved || approved.has(i);
              return (
                <div key={a.text} className="status-row">
                  <span className="text">{a.text}</span>
                  <span className="pill">
                    {!done && <span className="dot" aria-hidden="true" />}
                    {done ? "APPROVED" : "PENDING"}
                  </span>
                  {!done && (
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => setApproved((prev) => new Set(prev).add(i))}
                    >
                      Approve
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
