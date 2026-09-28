import { Suspense } from "react";
import { Loading, PageHeader } from "@/components/ui";
import Explorer from "./Explorer";

export default function ExplorerPage() {
  return (
    <>
      <PageHeader title="District Explorer">
        Pick a district and a Season A year to see its rainfall and vegetation anomalies, the
        predicted yield change, and the payout the index would have made.
      </PageHeader>
      <Suspense fallback={<Loading />}>
        <Explorer />
      </Suspense>
    </>
  );
}
