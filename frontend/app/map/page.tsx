import { Suspense } from "react";
import { Loading, PageHeader } from "@/components/ui";
import DroughtMap from "./DroughtMap";

export default function MapPage() {
  return (
    <>
      <PageHeader title="Drought Map">
        Where the index points to losses, district by district, for any season since 2001.
      </PageHeader>
      <Suspense fallback={<Loading />}>
        <DroughtMap />
      </Suspense>
    </>
  );
}
