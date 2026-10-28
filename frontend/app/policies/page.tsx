"use client";

import { RefreshCw } from "lucide-react";
import { useState } from "react";
import { Card, ErrorNote, Loading, PageHeader, StatStrip } from "@/components/ui";
import { getPolicies, USE_MOCK } from "@/lib/api";
import { DISTRICTS, USSD_CODE } from "@/lib/constants";
import { rwf } from "@/lib/pricing";
import { useApi } from "@/lib/useApi";

/** Sign-up time in Rwanda's time zone. */
const signedUp = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { timeZone: "Africa/Kigali", dateStyle: "medium", timeStyle: "short" });

export default function PoliciesPage() {
  // Each press of Refresh asks the API again (useApi reloads when its key changes).
  const [load, setLoad] = useState(0);
  const policies = useApi(`policies-${load}`, getPolicies);

  const refresh = (
    <button
      onClick={() => setLoad((n) => n + 1)}
      disabled={policies.loading}
      className="flex items-center gap-1.5 rounded-sm border border-line px-3 py-1.5 text-sm hover:bg-surface-2 disabled:opacity-50"
    >
      <RefreshCw size={14} className={policies.loading ? "animate-spin" : ""} />
      Refresh
    </button>
  );

  let body;
  if (policies.error) body = <ErrorNote message={policies.error} />;
  else if (!policies.data) body = <Loading />;
  else {
    const rows = policies.data;
    const areaHa = rows.reduce((s, p) => s + p.areaM2, 0) / 10_000;
    const premiums = rows.reduce((s, p) => s + p.premium, 0);
    const perDistrict = DISTRICTS.map((district) => ({
      district,
      count: rows.filter((p) => p.district === district).length,
    }));
    const covered = perDistrict.filter((d) => d.count > 0).length;
    const most = Math.max(1, ...perDistrict.map((d) => d.count));

    body = (
      <div className="space-y-5">
        <StatStrip
          items={[
            { value: String(rows.length), label: "Farmers signed up", note: "one policy per phone number" },
            { value: `${areaHa.toLocaleString("en-US", { maximumFractionDigits: 2 })} ha`, label: "Maize insured", note: "the field sizes farmers entered" },
            { value: rwf(premiums), label: "Premiums a season", note: "after the 40% subsidy" },
            { value: `${covered} of 7`, label: "Districts with a policy" },
          ]}
        />

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
          <Card
            label="Policies · newest first"
            title={rows.length ? `${rows.length} farmer${rows.length === 1 ? "" : "s"} signed up over USSD` : "No farmer has signed up yet"}
            source={`Farmers sign up by dialling ${USSD_CODE} from a number with no policy: they pick their district, enter their maize field size, see the insured value and premium, and confirm. The policy is stored against the phone number, the farmer gets an SMS with the policy number, and the insurer's phone gets an alert. Phone numbers are masked here; the full number stays in the database. The premium is the one quoted at sign-up, priced like the Pricing page's default terms.`}
          >
            {rows.length === 0 ? (
              <p className="text-sm text-muted">
                {USE_MOCK
                  ? "Sign-ups need the live API; the saved results have none."
                  : `Dial ${USSD_CODE} from a phone without a policy and choose 1 to buy cover. The policy appears here after Refresh.`}
              </p>
            ) : (
              <div className="-mx-2 overflow-x-auto">
                <table className="tabular w-full min-w-[680px] whitespace-nowrap text-sm">
                  <thead>
                    <tr className="text-left text-xs text-faint">
                      <th className="px-2 pb-2 font-medium">Policy</th>
                      <th className="px-2 pb-2 font-medium">District</th>
                      <th className="px-2 pb-2 text-right font-medium">Field size</th>
                      <th className="px-2 pb-2 text-right font-medium">Premium a season</th>
                      <th className="px-2 pb-2 font-medium">Cover</th>
                      <th className="px-2 pb-2 font-medium">Phone</th>
                      <th className="px-2 pb-2 font-medium">Signed up</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((p) => (
                      <tr key={p.policyId} className="border-t border-line">
                        <td className="px-2 py-2.5 font-mono text-[13px]">{p.policyId}</td>
                        <td className="px-2 py-2.5">{p.district}</td>
                        <td className="px-2 py-2.5 text-right">{p.areaM2.toLocaleString("en-US")} m²</td>
                        <td className="px-2 py-2.5 text-right">{rwf(p.premium)}</td>
                        <td className="px-2 py-2.5">Season A {p.season}</td>
                        <td className="px-2 py-2.5 text-muted">{p.phone}</td>
                        <td className="px-2 py-2.5 text-muted">{signedUp(p.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card label="By district" title={covered ? `Policies in ${covered} of 7 districts` : "No district yet"}>
            <ul className="space-y-2">
              {perDistrict.map((d) => (
                <li key={d.district} className="grid grid-cols-[88px_1fr_24px] items-center gap-2 text-sm">
                  <span>{d.district}</span>
                  <div className="h-2 bg-surface-2">
                    <div className="h-full bg-accent" style={{ width: `${(d.count / most) * 100}%` }} />
                  </div>
                  <span className="tabular text-right">{d.count}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <>
      <PageHeader title="Policies">{refresh}</PageHeader>
      {body}
    </>
  );
}
