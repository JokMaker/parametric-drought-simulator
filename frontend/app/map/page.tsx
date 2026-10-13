import { Suspense } from "react";
import { Loading, PageHeader } from "@/components/ui";
import DroughtMap from "./DroughtMap";

export default function MapPage() {
  return (
    <>
      <PageHeader eyebrow="Drought monitoring" title="Drought Map">
        The seven districts of Eastern Province, coloured by the index, the payout or the basis risk.
        Pick a season to see where the drought index points to losses.
      </PageHeader>
      <Suspense fallback={<Loading />}>
        <DroughtMap />
      </Suspense>
    </>
  );
}
