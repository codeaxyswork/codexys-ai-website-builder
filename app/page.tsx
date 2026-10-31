export const dynamic = "force-dynamic";
export const revalidate = 0;

import { Suspense } from "react";
import { HomeClient } from "@/components/HomeClient";

interface HomePageProps {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function Home({ searchParams }: HomePageProps) {
  const resolvedParams = searchParams ? await searchParams : {};
  const initialTemplate =
    typeof resolvedParams.template === "string" ? resolvedParams.template : undefined;
  const initialId =
    typeof resolvedParams.id === "string" ? resolvedParams.id : undefined;

  return (
    <Suspense fallback={null}>
      <HomeClient initialTemplate={initialTemplate} initialId={initialId} />
    </Suspense>
  );
}
