import type { Scenario } from "@/lib/mockScenarios";

type Props = {
  scenarios: Scenario[];
  activeId: string | null;
  onRun: (s: Scenario) => void;
  onReset: () => void;
  disabled?: boolean; // while a Reset is in flight
};

export default function ScenarioButtons({ scenarios, activeId, onRun, onReset, disabled }: Props) {
  return (
    <div className="cta-row">
      {scenarios.map((s) => (
        <button
          key={s.id}
          type="button"
          className="btn btn-secondary"
          disabled={disabled}
          style={activeId === s.id ? { borderColor: "var(--orange)" } : undefined}
          onClick={() => onRun(s)}
        >
          <span className="sc-k">{s.k}</span>
          {s.label}
          <span className="sc-k" style={{ margin: "0 0 0 12px" }}>
            {s.source}
          </span>
        </button>
      ))}
      <button type="button" className="btn btn-secondary" onClick={onReset} disabled={disabled} title="Clear incidents, events and audit trail. Seed data is kept.">
        Reset
      </button>
    </div>
  );
}
