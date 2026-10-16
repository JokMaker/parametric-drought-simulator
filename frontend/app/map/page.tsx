import { Suspense } from "react";
import { Loading, PageHeader } from "@/components/ui";
import DroughtMap from "./DroughtMap";

export default function MapPage() {
  return (
    <>
      <PageHeader title="Drought Map" />
      <Suspense fallback={<Loading />}>
        <DroughtMap />
      </Suspense>
    </>
  );
}
