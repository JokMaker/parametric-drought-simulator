import { Suspense } from "react";
import { Loading, PageHeader } from "@/components/ui";
import Explorer from "./Explorer";

export default function ExplorerPage() {
  return (
    <>
      <PageHeader eyebrow="Simulate a payout" title="District Explorer">
        Pick a district and a season to see what the satellites recorded, the yield change the
        index predicts, and the payout it would have made.
      </PageHeader>
      <Suspense fallback={<Loading />}>
        <Explorer />
      </Suspense>
    </>
  );
}
