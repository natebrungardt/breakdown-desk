import Dashboard from "@/components/Dashboard";

export default function Home() {
  return (
    <div>
      <div className="top-meta">
        <div
          className="wrap"
          style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 0, paddingBottom: 0, width: "100%" }}
        >
          <div className="left">
            <span>BREAKDOWN DESK · V0.1</span>
            <span style={{ opacity: 0.6 }}>OMAHA / CHICAGO / DENVER</span>
          </div>
          <div className="right">
            <span>
              <span className="dot" style={{ width: 6, height: 6, verticalAlign: 2, marginRight: 8 }} />
              SYSTEM RUNNING
            </span>
          </div>
        </div>
      </div>

      <nav className="top" aria-label="Primary">
        <div className="wrap nav-row">
          <a href="#" className="brand" aria-label="Breakdown Desk home">
            <span
              className="mark"
              style={{ border: "2px solid var(--fg)", width: 20, height: 20 }}
              aria-hidden="true"
            />
            <span className="wordmark">breakdown desk</span>
          </a>
        </div>
      </nav>

      <Dashboard />
    </div>
  );
}
