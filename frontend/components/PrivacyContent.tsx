"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { USSD_CODE } from "@/lib/constants";
import { useT } from "@/lib/i18n";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-line pt-5">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <div className="mt-2 space-y-2 text-sm leading-relaxed text-ink">{children}</div>
    </section>
  );
}

export default function PrivacyContent() {
  const { t } = useT();
  return (
    <div className="mx-auto max-w-3xl">
      <article className="card space-y-6 px-6 py-7 sm:px-8">
        <header>
          <div className="text-xs font-medium uppercase tracking-wider text-muted">{t("Privacy", "Ubuzima bwite")}</div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            {t("How this simulator handles your data", "Uko iyi porogaramu ifata amakuru yawe")}
          </h1>
          <p className="mt-2 text-sm text-muted">
            {t(
              "This is a student research prototype, not an insurance company. No policy here is a real contract, no premium is charged and no money is paid out.",
              "Iyi ni porogaramu y'ubushakashatsi y'umunyeshuri, si ikigo cy'ubwishingizi. Nta bwishingizi buri hano ari amasezerano nyayo, nta musanzu wishyuzwa kandi nta mafaranga atangwa.",
            )}
          </p>
        </header>

        <Section title={t("What we collect", "Amakuru tubika")}>
          <p>
            {t(
              "Most of the site uses district-level data only: satellite rainfall and crop greenness, and published harvest surveys. None of it is about a person.",
              "Igice kinini cy'urubuga gikoresha amakuru y'uturere gusa: imvura n'ubutoto bw'imyaka bipimwa n'ibyogajuru, n'amabarura y'umusaruro yatangajwe. Nta na kimwe muri byo kireba umuntu ku giti cye.",
            )}
          </p>
          <p>
            {t(
              `Personal data is stored only when someone signs up for a cover by dialling ${USSD_CODE}:`,
              `Amakuru bwite abikwa gusa iyo umuntu yiyandikishije ku bwishingizi akanze ${USSD_CODE}:`,
            )}
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>{t("the phone number they dialled from;", "nimero ya telefoni yakoresheje;")}</li>
            <li>{t("the district they chose and the size of their maize field;", "akarere yahisemo n'ubuso bw'umurima we w'ibigori;")}</li>
            <li>{t("the season covered, the premium quoted and the time of sign-up.", "igihembwe cyishingiwe, umusanzu yabwiwe n'igihe yiyandikishirije.")}</li>
          </ul>
          <p>
            {t(
              "A loss report stores the policy number, district, season, date and the cause chosen. It does not store a phone number.",
              "Raporo y'igihombo ibika nimero y'ubwishingizi, akarere, igihembwe, itariki n'impamvu yahiswemo. Ntibika nimero ya telefoni.",
            )}
          </p>
          <p>
            {t(
              "For each SMS we keep only the time, its length and whether it was live. We do not keep the message or the number it went to.",
              "Kuri buri SMS tubika gusa igihe yoherejwe, uburebure bwayo, n'uko yari nyayo cyangwa iy'igerageza. Ntitubika ubutumwa ubwabwo cyangwa nimero bwoherejweho.",
            )}
          </p>
        </Section>

        <Section title={t("Why", "Impamvu")}>
          <p>
            {t(
              "The phone number is how the USSD menu recognises a returning farmer and where the policy SMS is sent. The district and field size set the cover and premium. Nothing is used for marketing, and no profile is built.",
              "Nimero ya telefoni ni yo ituma menu ya USSD imenya umuhinzi wagarutse, kandi ni yo SMS y'ubwishingizi yoherezwaho. Akarere n'ubuso bw'umurima bigena agaciro kishingiwe n'umusanzu. Nta na kimwe gikoreshwa mu kwamamaza, kandi nta makuru y'umuntu akusanywa ngo amumenye birambuye.",
            )}
          </p>
        </Section>

        <Section title={t("Where it is kept and who sees it", "Aho abikwa n'abayabona")}>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              {t(
                "The data is stored in a Neon Postgres database and served by the project's backend on Render.",
                "Amakuru abikwa mu bubiko bwa Neon Postgres kandi agatangwa na backend y'umushinga iri kuri Render.",
              )}
            </li>
            <li>
              {t(
                "USSD and SMS go through Africa's Talking, which must see the phone number to deliver the message. The service runs in Africa's Talking's sandbox, so messages reach a test simulator, not real phones.",
                "USSD na SMS binyura kuri Africa's Talking, igomba kubona nimero ya telefoni kugira ngo igeze ubutumwa. Serivisi ikorera muri sandbox ya Africa's Talking, bityo ubutumwa bugera kuri simulator y'igerageza, si kuri telefoni nyazo.",
              )}
            </li>
            <li>
              {t("The", "Paji ya")}{" "}
              <Link href="/policies" className="text-accent underline-offset-2 hover:underline">
                {t("Policies", "Ubwishingizi bwatanzwe")}
              </Link>{" "}
              {t(
                "page shows phone numbers masked (for example +250••••123). The full number is never shown on the site.",
                "igaragaza nimero za telefoni zihishe (urugero +250••••123). Nimero yuzuye ntigaragazwa ku rubuga.",
              )}
            </li>
            <li>{t("Data is not sold or shared with anyone else.", "Amakuru ntagurishwa kandi ntahabwa undi muntu.")}</li>
          </ul>
        </Section>

        <Section title={t("In your browser", "Muri mushakisha yawe")}>
          <p>
            {t(
              "The site remembers your language, your light or dark theme and, on the USSD Menu page, the demo phone number you typed. All are kept in your own browser's storage and are never sent to us. There are no advertising cookies and no tracking.",
              "Urubuga rwibuka ururimi rwawe, urumuri cyangwa umwijima wahisemo, na nimero y'icyitegererezo wanditse kuri paji ya Menu ya USSD. Byose bibikwa muri mushakisha yawe kandi ntibitwoherezwa. Nta cookies z'amatangazo cyangwa ugukurikirana bihari.",
            )}
          </p>
        </Section>

        <Section title={t("How long it is kept", "Igihe amakuru abikwa")}>
          <p>
            {t(
              "There is no automatic deletion yet. Test sign-ups are removed by hand, and all personal data will be deleted when the project ends. You can ask for your number and policy to be removed at any time.",
              "Nta gusiba kwikora kurahari. Abiyandikishije mu igerageza basibwa n'intoki, kandi amakuru bwite yose azasibwa umushinga urangiye. Ushobora gusaba ko nimero yawe n'ubwishingizi bwawe bisibwa igihe icyo ari cyo cyose.",
            )}
          </p>
        </Section>

        <Section title={t("Your rights", "Uburenganzira bwawe")}>
          <p>
            {t(
              "Rwanda's Law No. 058/2021 on the protection of personal data and privacy gives you the right to know what is held about you, to have it corrected and to have it deleted. To use any of these rights, contact the project author through the capstone supervisors.",
              "Itegeko No 058/2021 ryerekeye kurinda amakuru bwite n'ubuzima bwite riguha uburenganzira bwo kumenya amakuru akubitsweho, kuyakosoza no kuyasibisha. Kugira ngo ukoreshe ubwo burenganzira, vugana n'umwanditsi w'umushinga binyuze ku barimu bayobora umushinga we wa capstone.",
            )}
          </p>
        </Section>

        <footer className="border-t border-line pt-4 text-xs text-muted">
          {t(
            "A real insurer running this scheme would need its own registered privacy notice and data processing agreements. This page describes the prototype only.",
            "Ikigo cy'ubwishingizi nyacyo gikoresheje ubu buryo cyakenera amabwiriza yacyo bwite y'ubuzima bwite yanditswe n'amasezerano yo gutunganya amakuru. Iyi paji isobanura porogaramu y'igerageza gusa.",
          )}
        </footer>
      </article>
    </div>
  );
}
