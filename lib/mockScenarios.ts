// Draft only: browser-side sample data so the dashboard can be rehearsed.
// Tomorrow the buttons POST to /api/signals/[source] and the feed comes from Supabase Realtime.

export type FeedState = "live" | "routing" | "review" | "booked" | "filed";

export type Step = { layer: number; state: FeedState; text: string };

export type Scenario = {
  id: string;
  k: string;
  label: string;
  source: string;
  summary: { k: string; v: string; pill?: string }[];
  audit: { k: string; v: string; reason: string; source: "rule" | "llm" | "human" }[];
  actions: { text: string; approved: boolean }[];
  steps: Step[];
};

export const LAYERS = ["Signals", "Units", "Decisions", "Counterparties", "Actions", "Records"];

export const SCENARIOS: Scenario[] = [
  {
    id: "oil",
    k: "01",
    label: "Oil pressure critical",
    source: "Geotab",
    summary: [
      { k: "Truck", v: "Unit 3847 · Freightliner Cascadia 2024", pill: "In warranty" },
      { k: "Fault", v: "SPN 100 / FMI 1 · Engine oil pressure, critical", pill: "Geotab" },
      { k: "Where", v: "I-80 W, MP 213" },
      { k: "Load", v: "Midwest Grocers Co-op · due in 9h" },
    ],
    audit: [
      { k: "Severity", v: "stop_now", reason: "Critical oil pressure", source: "rule" },
      { k: "Tow", v: "required", reason: "stop_now implies tow", source: "rule" },
      { k: "Recoverable", v: "engine, in warranty", reason: "148k mi / 31 mo vs 500k mi / 60 mo", source: "rule" },
    ],
    actions: [
      { text: "Tow + shop booking, OEM dealer", approved: false },
      { text: "SMS to driver with tow ETA", approved: false },
      { text: "Warranty claim, engine", approved: false },
    ],
    steps: [
      { layer: 0, state: "live", text: "Signal received from Geotab. Normalized to SPN 100 / FMI 1 (engine oil pressure), I-80 W, MP 213." },
      { layer: 1, state: "live", text: "Unit 3847 resolved. Freightliner Cascadia 2024, 148,230 mi. Load L9001 due in 9h." },
      { layer: 2, state: "routing", text: "Severity STOP_NOW. Rule: critical oil pressure. LLM not called." },
      { layer: 2, state: "review", text: "Tow required. Decision flagged for approval." },
      { layer: 2, state: "live", text: "Engine under warranty (148k mi / 31 mo vs 500k mi / 60 mo). Claim recoverable." },
      { layer: 3, state: "routing", text: "Requesting quotes from capable shops. OEM dealer preferred under warranty." },
      { layer: 3, state: "booked", text: "3 quotes received. OEM dealer ranked first (under warranty)." },
      { layer: 4, state: "review", text: "Drafted tow + shop booking, driver SMS and warranty claim. Pending approval." },
      { layer: 5, state: "filed", text: "Repair order and claim line written. Audit trail saved." },
    ],
  },
  {
    id: "dpf",
    k: "02",
    label: "DPF warning",
    source: "Samsara",
    summary: [
      { k: "Truck", v: "Unit 4120 · Volvo VNL 860 2025", pill: "In warranty" },
      { k: "Fault", v: "SPN 3251 / FMI 16 · DPF differential pressure high", pill: "Samsara" },
      { k: "Where", v: "I-80 E, MP 291" },
      { k: "Load", v: "Great Plains Beverage · due in 20h" },
    ],
    audit: [
      { k: "Severity", v: "limp_to_shop", reason: "Confidence 0.82, escalated from floor schedule_later", source: "llm" },
      { k: "Tow", v: "not needed", reason: "Truck can drive to shop", source: "rule" },
      { k: "Recoverable", v: "aftertreatment, in warranty", reason: "62k mi / 20 mo vs 300k mi / 36 mo", source: "rule" },
    ],
    actions: [
      { text: "Shop booking, Volvo dealer", approved: false },
      { text: "SMS to driver with shop directions", approved: false },
      { text: "Warranty claim, aftertreatment", approved: false },
    ],
    steps: [
      { layer: 0, state: "live", text: "Signal received from Samsara. Normalized to SPN 3251 / FMI 16 (DPF differential pressure), I-80 E, MP 291." },
      { layer: 1, state: "live", text: "Unit 4120 resolved. Volvo VNL 860 2025, 62,410 mi. Load L9004 due in 20h." },
      { layer: 2, state: "routing", text: "Rules set floor: schedule_later. Asking LLM to triage." },
      { layer: 2, state: "live", text: "LLM: limp_to_shop, confidence 0.82. Final severity limp_to_shop." },
      { layer: 2, state: "live", text: "Aftertreatment under warranty (62k mi / 20 mo vs 300k mi / 36 mo). Claim recoverable." },
      { layer: 3, state: "routing", text: "Requesting quotes. In warranty, so Volvo dealer preferred." },
      { layer: 3, state: "booked", text: "3 quotes received. High Plains Volvo Trucks (North Platte) ranked first." },
      { layer: 4, state: "review", text: "Drafted shop booking, driver SMS and warranty claim. Pending approval." },
      { layer: 5, state: "filed", text: "Repair order and claim line written. Audit trail saved." },
    ],
  },
  {
    id: "tire",
    k: "03",
    label: "Slow tire leak",
    source: "Driver",
    summary: [
      { k: "Truck", v: "Unit 4590 · Peterbilt 579 2023", pill: "Tires out of warranty" },
      { k: "Fault", v: "Left rear drive tire losing pressure slowly", pill: "Driver" },
      { k: "Where", v: "I-80 E, MP 284" },
      { k: "Load", v: "Summit Appliance · due in 22h" },
    ],
    audit: [
      { k: "Severity", v: "schedule_later", reason: "Confidence 0.91, slow leak", source: "llm" },
      { k: "Tow", v: "not needed", reason: "Truck can keep driving", source: "rule" },
      { k: "Recoverable", v: "no", reason: "276k mi vs 100k mi / 12 mo", source: "rule" },
    ],
    actions: [
      { text: "Shop booking, tire shop", approved: true },
      { text: "SMS to driver with appointment", approved: true },
    ],
    steps: [
      { layer: 0, state: "live", text: "Driver message normalized to a tire pressure fault, I-80 E, MP 284." },
      { layer: 1, state: "live", text: "Unit 4590 resolved. Peterbilt 579 2023, 276,340 mi. Load L9008 due in 22h." },
      { layer: 2, state: "routing", text: "Rules set floor: schedule_later. Asking LLM to triage." },
      { layer: 2, state: "live", text: "LLM: schedule_later, confidence 0.91. Final severity schedule_later." },
      { layer: 2, state: "live", text: "Tires out of warranty (276k mi vs 100k mi / 12 mo). No claim." },
      { layer: 3, state: "routing", text: "Requesting quotes from tire shops." },
      { layer: 3, state: "booked", text: "2 quotes received. Kearney Tire & Wheel ranked first." },
      { layer: 4, state: "booked", text: "Shop booking and driver SMS auto-approved." },
      { layer: 5, state: "filed", text: "Repair order written. Audit trail saved." },
    ],
  },
];
