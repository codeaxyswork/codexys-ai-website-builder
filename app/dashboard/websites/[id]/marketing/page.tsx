import { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { MarketingClient } from "./MarketingClient";

export const metadata: Metadata = {
  title: "AI Marketing Agent — Codeaxys",
  description: "Meta & Google Ads Campaign Management, Lead Inbox, and Social Marketing",
};

export default async function MarketingDashboardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: websiteId } = await params;

  if (!websiteId) {
    notFound();
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Verify website ownership
  const { data: website, error } = await supabase
    .from("websites")
    .select("id, title, slug, published_slug, user_id, updated_at, design_plan")
    .eq("id", websiteId)
    .eq("user_id", user.id)
    .single();

  if (error || !website) {
    notFound();
  }

  return <MarketingClient website={website} />;
}
