import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/auth/admin";
import { getConceptOptions, getDraftQuestions, getUsageSummary } from "@/lib/data/studio";
import { Studio } from "./studio-client";

export const dynamic = "force-dynamic";

export default async function StudioPage() {
  const admin = await getAdminUser();
  // Authenticated non-admins are sent back to their dashboard.
  if (!admin) redirect("/dashboard");

  const [concepts, drafts, usage] = await Promise.all([
    getConceptOptions(),
    getDraftQuestions(),
    getUsageSummary(),
  ]);

  return <Studio adminEmail={admin.email} concepts={concepts} drafts={drafts} usage={usage} />;
}
