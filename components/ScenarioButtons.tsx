import type { Scenario } from "@/lib/mockScenarios";

type Props = {
  scenarios: Scenario[];
  activeId: string | null;
  onRun: (s: Scenario) => void;
};

export default function ScenarioButtons({ scenarios, activeId, onRun }: Props) {
  return (
    <div className="cta-row">
      {scenarios.map((s) => (
        <button
          key={s.id}
          type="button"
          className="btn btn-secondary"
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
    </div>
  );
}
