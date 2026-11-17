"use client";

import { RefreshCw } from "lucide-react";
import { useState } from "react";
import { Card, ErrorNote, Loading, PageHeader, StatStrip, SwipeHint } from "@/components/ui";
import { getPolicies, USE_MOCK } from "@/lib/api";
import { DISTRICTS, USSD_CODE } from "@/lib/constants";
import { useT } from "@/lib/i18n";
import { rwf } from "@/lib/pricing";
import { useApi } from "@/lib/useApi";

/** Sign-up time in Rwanda's time zone. */
const signedUp = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { timeZone: "Africa/Kigali", dateStyle: "medium", timeStyle: "short" });

export default function PoliciesPage() {
  // Each press of Refresh asks the API again (useApi reloads when its key changes).
  const [load, setLoad] = useState(0);
  const policies = useApi(`policies-${load}`, getPolicies);
  const { t } = useT();

  const refresh = (
    <button
      onClick={() => setLoad((n) => n + 1)}
      disabled={policies.loading}
      className="flex items-center gap-1.5 rounded-sm border border-line px-3 py-1.5 text-sm hover:bg-surface-2 disabled:opacity-50"
    >
      <RefreshCw size={14} className={policies.loading ? "animate-spin" : ""} />
      {t("Refresh", "Vugurura")}
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
            { value: String(rows.length), label: t("Farmers signed up", "Abahinzi biyandikishije"), note: t("one policy per phone number", "ubwishingizi bumwe kuri nimero ya telefoni") },
            { value: `${areaHa.toLocaleString("en-US", { maximumFractionDigits: 2 })} ha`, label: t("Maize insured", "Ibigori byishingiwe"), note: t("the field sizes farmers entered", "ubuso abahinzi banditse") },
            { value: rwf(premiums), label: t("Premiums a season", "Imisanzu ku gihembwe"), note: t("after the 40% subsidy", "nyuma y'inkunga ya 40%") },
            { value: t(`${covered} of 7`, `${covered} kuri 7`), label: t("Districts with a policy", "Uturere dufite ubwishingizi") },
          ]}
        />

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
          <Card
            label={t("Policies · newest first", "Ubwishingizi · ubwa vuba mbere")}
            title={
              rows.length
                ? t(
                    `${rows.length} farmer${rows.length === 1 ? "" : "s"} signed up over USSD or the web demo phone`,
                    `Abahinzi ${rows.length} biyandikishije kuri USSD cyangwa kuri telefoni y'icyitegererezo yo ku rubuga`,
                  )
                : t("No farmer has signed up yet", "Nta muhinzi uriyandikisha")
            }
            source={t(`Farmers sign up by dialling ${USSD_CODE} from a number with no policy: they pick their district, enter their maize field size, see the insured value and premium, and confirm. The policy is stored against the phone number, the farmer gets an SMS with the policy number, and the insurer's phone gets an alert. Sign-ups from the USSD Menu page's on-screen phone use a demo number, get no SMS and are marked "web demo". Phone numbers are masked here; the full number stays in the database. The premium is the one quoted at sign-up, priced like the Pricing page's default terms.`, `Abahinzi biyandikisha bakanda ${USSD_CODE} kuri nimero idafite ubwishingizi: bahitamo akarere kabo, bakandika ubuso bw'umurima w'ibigori, bakabona agaciro kishingiwe n'umusanzu, hanyuma bakemeza. Ubwishingizi bubikwa kuri nimero ya telefoni, umuhinzi akakira SMS irimo nimero y'ubwishingizi, na telefoni y'ikigo cy'ubwishingizi ikabimenyeshwa. Abiyandikishije bakoresheje telefoni yo kuri paji ya Menu ya USSD bakoresha nimero y'icyitegererezo, ntibohererezwa SMS kandi bagaragazwa nk'"icyitegererezo". Nimero za telefoni hano zirahishe; nimero yuzuye iguma mu bubiko bw'amakuru. Umusanzu ni uwo babwiwe biyandikisha, ubazwe nk'uko biri ku paji y'Ibiciro.`)}
          >
            {rows.length > 0 && <SwipeHint text={t("Swipe the table sideways for more columns", "Kurura imbonerahamwe ku ruhande urebe izindi nkingi")} />}
            {rows.length === 0 ? (
              <p className="text-sm text-muted">
                {USE_MOCK
                  ? t("Sign-ups need the live API; the saved results have none.", "Kwiyandikisha bikenera API ikora; ibisubizo byabitswe nta byo birimo.")
                  : t(
                      `Dial ${USSD_CODE} from a phone without a policy and choose 1 to buy cover. The policy appears here after Refresh.`,
                      `Kanda ${USSD_CODE} kuri telefoni idafite ubwishingizi uhitemo 1 kugira ngo ugure ubwishingizi. Buzagaragara hano nyuma yo gukanda Vugurura.`,
                    )}
              </p>
            ) : (
              <div className="-mx-2 overflow-x-auto">
                <table className="tabular w-full min-w-[680px] whitespace-nowrap text-sm">
                  <thead>
                    <tr className="text-left text-xs text-faint">
                      <th className="px-2 pb-2 font-medium">{t("Policy", "Nimero")}</th>
                      <th className="px-2 pb-2 font-medium">{t("District", "Akarere")}</th>
                      <th className="px-2 pb-2 text-right font-medium">{t("Field size", "Ubuso bw'umurima")}</th>
                      <th className="px-2 pb-2 text-right font-medium">{t("Premium a season", "Umusanzu ku gihembwe")}</th>
                      <th className="px-2 pb-2 font-medium">{t("Cover", "Igihembwe cyishingiwe")}</th>
                      <th className="px-2 pb-2 font-medium">{t("Phone", "Telefoni")}</th>
                      <th className="px-2 pb-2 font-medium">{t("Signed up", "Igihe yiyandikishije")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((p) => (
                      <tr key={p.policyId} className="border-t border-line">
                        <td className="px-2 py-2.5 font-mono text-[13px]">{p.policyId}</td>
                        <td className="px-2 py-2.5">{p.district}</td>
                        <td className="px-2 py-2.5 text-right">{p.areaM2.toLocaleString("en-US")} m²</td>
                        <td className="px-2 py-2.5 text-right">{rwf(p.premium)}</td>
                        <td className="px-2 py-2.5">{t("Season A", "Igihembwe A")} {p.season}</td>
                        <td className="px-2 py-2.5 text-muted">{p.channel === "web" ? t("web demo", "icyitegererezo") : p.phone}</td>
                        <td className="px-2 py-2.5 text-muted">{signedUp(p.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card
            label={t("By district", "Ku karere")}
            title={covered ? t(`Policies in ${covered} of 7 districts`, `Ubwishingizi mu turere ${covered} kuri 7`) : t("No district yet", "Nta karere karabona ubwishingizi")}
          >
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
      <PageHeader title={t("Policies", "Ubwishingizi bwatanzwe")}>{refresh}</PageHeader>
      {body}
    </>
  );
}
