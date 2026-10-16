import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import Script from "next/script";
import TopNav from "@/components/TopNav";
import { USE_MOCK } from "@/lib/api";
import "./globals.css";

const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Drought Index Simulator",
  description:
    "Parametric drought-index insurance simulator for smallholder maize farmers in Eastern Rwanda.",
};

// Apply a saved theme before first paint so there is no flash.
const THEME_SCRIPT = `try{var t=localStorage.getItem("theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${plexSans.variable} ${plexMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      {/* Browser extensions (e.g. Grammarly) add attributes to <body> before React loads. */}
      <body className="flex min-h-full flex-col font-sans" suppressHydrationWarning>
        <Script id="theme" strategy="beforeInteractive">
          {THEME_SCRIPT}
        </Script>
        <TopNav />
        {USE_MOCK && (
          <div className="border-b border-line bg-surface-2 px-4 py-1.5 text-center text-xs text-muted">
            Showing saved results: the backend is not connected.
          </div>
        )}
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-7 sm:px-6">{children}</main>
        <footer className="border-t border-line">
          <div className="mx-auto max-w-5xl px-4 py-4 text-xs text-faint sm:px-6">
            Data: CHIRPS rainfall, MODIS NDVI (via Google Earth Engine), NISR Seasonal Agricultural
            Survey. District-level data only; no farmer records.
          </div>
        </footer>
      </body>
    </html>
  );
}
