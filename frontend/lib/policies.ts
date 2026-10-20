import { DISTRICTS } from "./constants";

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
    phone: `07•• ••• ${String(100 + d * 13 + k * 7).slice(-3)}`,
  })),
);

export const findPolicy = (id: string) => DEMO_POLICIES.find((p) => p.id.toLowerCase() === id.trim().toLowerCase());
