import type { Category } from "../types";

// J1939 SPN -> what the fault is about.
const SPN_CATEGORY: Record<number, Category> = {
  100: "oil_pressure", // engine oil pressure
  110: "coolant_temp", // engine coolant temperature
  3251: "dpf", // DPF differential pressure
  3250: "dpf", // DPF intake pressure
  241: "tire_pressure", // tire pressure
  116: "brakes", // brake primary pressure
  117: "brakes", // brake secondary pressure
  118: "brakes", // brake application pressure
};

export const categoryForSpn = (spn: number): Category => SPN_CATEGORY[spn] ?? "other";
