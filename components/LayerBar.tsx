import { LAYERS } from "@/lib/mockScenarios";

// current: index of the layer running, -1 = idle, 6 = finished.
export default function LayerBar({ current }: { current: number }) {
  return (
    <div className="verbs six">
      {LAYERS.map((name, i) => {
        const live = i === current;
        const done = current > i;
        const state = live ? "Routing" : done ? "Done" : current === -1 ? "Idle" : "Waiting";
        return (
          <div key={name} className="v">
            <span className="k">{String(i + 1).padStart(2, "0")}</span>
            <span className="w">{name}</span>
            <span className={live ? "st live" : "st"}>
              {live && <span className="dot" aria-hidden="true" />}
              {state.toUpperCase()}
            </span>
          </div>
        );
      })}
    </div>
  );
}
