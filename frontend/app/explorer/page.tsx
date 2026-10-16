import { Suspense } from "react";
import { Loading, PageHeader } from "@/components/ui";
import Explorer from "./Explorer";

export default function ExplorerPage() {
  return (
    <>
      <PageHeader title="District Explorer" />
      <Suspense fallback={<Loading />}>
        <Explorer />
      </Suspense>
    </>
  );
}
