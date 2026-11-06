import { DISTRICTS } from "./constants";
import type { RegisteredPolicy } from "./types";

// Synthetic demo policies: no real farmer, name or phone number is used. Maize areas
// are typical smallholder sizes (the survey median is about 600 m2).
export type Policy = { id: string; district: string; areaM2: number; phone: string };

const CODE: Record<string, string> = {
  Bugesera: "BUG", Gatsibo: "GAT", Kayonza: "KAY", Kirehe: "KIR", Ngoma: "NGO", Nyagatare: "NYA", Rwamagana: "RWA",
};

export const DEMO_POLICIES: Policy[] = DISTRICTS.flatMap((district, d) =>
  [1, 2].map((k) => ({
    id: `RDI-${CODE[district]}-${String(1000 + d * 37 + k * 11).padStart(4, "0")}`,
    district,
    areaM2: k === 1 ? 600 + d * 40 : 2_500 + d * 150,
    // Masked with plain "x": a "•" would switch the SMS to UCS-2 and triple its cost.
    phone: `07xx xxx ${String(100 + d * 13 + k * 7).slice(-3)}`,
  })),
);

/** A policy a farmer signed up for (USSD or the web phone), in the shape the demo policies use. */
export const fromRegistered = (r: RegisteredPolicy): Policy => ({
  id: r.policyId,
  district: r.district,
  areaM2: r.areaM2,
  // The API sends "+250••••456"; keep the last three digits, masked like the demo numbers.
  phone: `07xx xxx ${r.phone.slice(-3)}`,
});

/** Looks a policy number up among the demo policies and any signed-up ones, ignoring case. */
export const findPolicy = (id: string, signedUp: Policy[] = []) =>
  [...DEMO_POLICIES, ...signedUp].find((p) => p.id.toLowerCase() === id.trim().toLowerCase());
