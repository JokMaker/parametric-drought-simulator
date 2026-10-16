import { Suspense } from "react";
import { Loading, PageHeader } from "@/components/ui";
import Explorer from "./Explorer";

export default function ExplorerPage() {
  return (
    <>
      <PageHeader title="District Explorer">
        One district, one season: what the satellites recorded and what the index would pay.
      </PageHeader>
      <Suspense fallback={<Loading />}>
        <Explorer />
      </Suspense>
    </>
  );
}
