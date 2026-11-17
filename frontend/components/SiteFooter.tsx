"use client";

import Link from "next/link";
import { useT } from "@/lib/i18n";

export default function SiteFooter() {
  const { t } = useT();
  return (
    <footer className="border-t border-line print:hidden">
      <div className="mx-auto max-w-[1680px] px-4 py-4 text-xs text-faint sm:px-6 lg:px-8">
        {t(
          "Data: CHIRPS rainfall, MODIS NDVI (via Google Earth Engine), NISR Seasonal Agricultural Survey. The model uses district-level data only; USSD sign-ups store a phone number.",
          "Amakuru: imvura ya CHIRPS, ubutoto bw'imyaka bwa MODIS NDVI (binyuze kuri Google Earth Engine), n'Ibarura ry'Ubuhinzi ry'Ibihembwe rya NISR. Moderi ikoresha amakuru y'uturere gusa; kwiyandikisha kuri USSD bibika nimero ya telefoni.",
        )}{" "}
        <Link href="/privacy" className="underline underline-offset-2 hover:text-ink">
          {t("Privacy", "Ubuzima bwite")}
        </Link>
      </div>
    </footer>
  );
}
