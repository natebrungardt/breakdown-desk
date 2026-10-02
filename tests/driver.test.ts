import { describe, expect, it } from "vitest";
import { adaptDriver } from "../lib/adapters/driver";

const classify = (message: string) => adaptDriver({ unitNumber: "4590", message }).category;

describe("driver adapter: keyword classification", () => {
  it.each([
    ["Coolant is boiling over", "coolant_temp"], // "boiling" contains "oil"
    ["Engine temperature gauge is pegged", "coolant_temp"],
    ["Truck is overheating on the grade", "coolant_temp"],
    ["Oil and coolant are mixing", "coolant_temp"], // coolant is checked before oil
    ["Oil pressure light came on", "oil_pressure"],
    ["Brakes feel soft", "brakes"],
    ["Braking pulls to the right", "brakes"],
    ["Slow leak, down 3 psi an hour", "tire_pressure"],
    ["Blew a tire", "tire_pressure"],
    ["DPF light is on, regen won't finish", "dpf"],
  ])("%s -> %s", (message, expected) => {
    expect(classify(message)).toBe(expected);
  });

  it.each([
    "Strap came loose on the flatbed", // "flatbed" contains "flat"
    "Second attempt to restart failed", // "attempt" contains "temp"
    "Truck is pulling hard left and I smell burning",
  ])("%s -> other", (message) => {
    expect(classify(message)).toBe("other");
  });
});

describe("driver adapter: location", () => {
  it("geocodes a milepost along I-80", () => {
    const f = adaptDriver({ unitNumber: "4590", message: "Tire losing air on I-80 E near MP 284." });
    expect(f.location).toBe("I-80 E, MP 284");
    expect(f.lat).toBeTypeOf("number");
    expect(f.lng).toBeTypeOf("number");
  });

  it("leaves the position unknown when no milepost is given", () => {
    const f = adaptDriver({ unitNumber: "4590", message: "Tire losing air, not sure where I am" });
    expect(f.location).toBe("Location not given");
    expect(f.lat).toBeNull();
    expect(f.lng).toBeNull();
  });

  it("rejects a message without a unit number or text", () => {
    expect(() => adaptDriver({ message: "Flat tire" })).toThrow();
    expect(() => adaptDriver({ unitNumber: "4590", message: "  " })).toThrow();
  });
});
