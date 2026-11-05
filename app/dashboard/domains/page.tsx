import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

export default async function DashboardDomainsRedirectPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Find user's latest website
  const { data: website } = await supabase
    .from("websites")
    .select("id")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (website?.id) {
    redirect(`/dashboard/websites/${website.id}/domain`);
  }

  // If no websites created yet, redirect to dashboard
  redirect("/dashboard");
}

