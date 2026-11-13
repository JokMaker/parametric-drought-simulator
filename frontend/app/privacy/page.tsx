import type { Metadata } from "next";
import Link from "next/link";
import { USSD_CODE } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Privacy · Drought Index Simulator",
  description: "What the drought index simulator collects, why, where it is kept and who sees it.",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-line pt-5">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <div className="mt-2 space-y-2 text-sm leading-relaxed text-ink">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <article className="card space-y-6 px-6 py-7 sm:px-8">
        <header>
          <div className="text-xs font-medium uppercase tracking-wider text-muted">Privacy</div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">How this simulator handles your data</h1>
          <p className="mt-2 text-sm text-muted">
            This is a student research prototype, not an insurance company. No policy here is a real contract,
            no premium is charged and no money is paid out.
          </p>
        </header>

        <Section title="What we collect">
          <p>Most of the site uses district-level data only: satellite rainfall and crop greenness, and published harvest surveys. None of it is about a person.</p>
          <p>Personal data is stored only when someone signs up for a cover by dialling {USSD_CODE}:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>the phone number they dialled from;</li>
            <li>the district they chose and the size of their maize field;</li>
            <li>the season covered, the premium quoted and the time of sign-up.</li>
          </ul>
          <p>A loss report stores the policy number, district, season, date and the cause chosen. It does not store a phone number.</p>
          <p>For each SMS we keep only the time, its length and whether it was live. We do not keep the message or the number it went to.</p>
        </Section>

        <Section title="Why">
          <p>The phone number is how the USSD menu recognises a returning farmer and where the policy SMS is sent. The district and field size set the cover and premium. Nothing is used for marketing, and no profile is built.</p>
        </Section>

        <Section title="Where it is kept and who sees it">
          <ul className="list-disc space-y-1 pl-5">
            <li>The data is stored in a Neon Postgres database and served by the project&apos;s backend on Render.</li>
            <li>USSD and SMS go through Africa&apos;s Talking, which must see the phone number to deliver the message. The service runs in Africa&apos;s Talking&apos;s sandbox, so messages reach a test simulator, not real phones.</li>
            <li>
              The <Link href="/policies" className="text-accent underline-offset-2 hover:underline">Policies</Link> page
              shows phone numbers masked (for example +250••••123). The full number is never shown on the site.
            </li>
            <li>Data is not sold or shared with anyone else.</li>
          </ul>
        </Section>

        <Section title="In your browser">
          <p>The site remembers your light or dark theme and, on the USSD Menu page, the demo phone number you typed. Both are kept in your own browser&apos;s storage and are never sent to us. There are no advertising cookies and no tracking.</p>
        </Section>

        <Section title="How long it is kept">
          <p>There is no automatic deletion yet. Test sign-ups are removed by hand, and all personal data will be deleted when the project ends. You can ask for your number and policy to be removed at any time.</p>
        </Section>

        <Section title="Your rights">
          <p>
            Rwanda&apos;s Law No. 058/2021 on the protection of personal data and privacy gives you the right to know what is held about you, to have it corrected and to have it deleted. To use any of these rights, contact the project author through the capstone supervisors.
          </p>
        </Section>

        <footer className="border-t border-line pt-4 text-xs text-muted">
          A real insurer running this scheme would need its own registered privacy notice and data processing agreements.
          This page describes the prototype only.
        </footer>
      </article>
    </div>
  );
}
