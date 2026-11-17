import type { Metadata } from "next";
import PrivacyContent from "@/components/PrivacyContent";

export const metadata: Metadata = {
  title: "Privacy · Drought Index Simulator",
  description: "What the drought index simulator collects, why, where it is kept and who sees it.",
};

export default function PrivacyPage() {
  return <PrivacyContent />;
}
