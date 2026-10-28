"""Policies and what their cover costs.

The demo policies are synthetic (no real farmer); they match frontend/lib/policies.ts.
Farmers who sign up over USSD get a policy of the same shape, stored in the
database (reports.ReportStore) against their phone number.
A quote prices a policy the way the dashboard's Pricing page does: crop value =
maize area x expected yield x farm-gate price; cover = the share of that value lost
at the exit; premium = cover x the district's average payout share, plus a loading,
less a subsidy.
"""

from dataclasses import dataclass

from .data import Dataset

DISTRICT_CODES = {"Bugesera": "BUG", "Gatsibo": "GAT", "Kayonza": "KAY", "Kirehe": "KIR",
                  "Ngoma": "NGO", "Nyagatare": "NYA", "Rwamagana": "RWA"}


MIN_AREA_M2 = 50  # the smallest plot the dashboard prices
MAX_AREA_M2 = 100_000  # 10 ha, far above any smallholder plot


def phone_key(phone: str) -> str:
    """The last nine digits, so +250788... and 0788... are the same number."""
    return "".join(c for c in phone if c.isdigit())[-9:]


def mask_phone(phone: str) -> str:
    return f"{phone[:4]}••••{phone[-3:]}" if len(phone) > 7 else ""


@dataclass(frozen=True)
class Policy:
    id: str
    district: str
    area_m2: int

    @property
    def hectares(self) -> float:
        return self.area_m2 / 10_000


class PolicyBook:
    """All demo policies: two per district, a typical and a large maize plot."""

    def __init__(self):
        self._by_id: dict[str, Policy] = {}
        for d, district in enumerate(DISTRICT_CODES):
            for k in (1, 2):
                policy = Policy(
                    id=f"RDI-{DISTRICT_CODES[district]}-{1000 + d * 37 + k * 11:04d}",
                    district=district,
                    area_m2=600 + d * 40 if k == 1 else 2_500 + d * 150,
                )
                self._by_id[policy.id] = policy

    def __contains__(self, policy_id: str) -> bool:
        return policy_id in self._by_id

    def get(self, policy_id: str) -> Policy:
        return self._by_id[policy_id]

    def ids(self) -> list[str]:
        return list(self._by_id)


@dataclass(frozen=True)
class CoverQuote:
    value: float  # RWF the maize is worth
    cover: float  # RWF paid at a full payout
    premium: float  # RWF the farmer pays per season, after subsidy

    LOADING = 0.3  # the dashboard's default terms
    SUBSIDY = 0.4

    @classmethod
    def for_policy(cls, ds: Dataset, policy: Policy) -> "CoverQuote":
        inputs = ds.meta["pricing_inputs"]
        value = policy.hectares * inputs["expected_yield_kg_ha"][policy.district] * inputs["maize_price_rwf_kg"]
        cover = value * abs(ds.model.exit) / 100
        premium = cover * ds.payout_rate(policy.district) * (1 + cls.LOADING) * (1 - cls.SUBSIDY)
        return cls(value, cover, premium)
