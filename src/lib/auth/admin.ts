import "server-only";
import { createClient } from "@/lib/supabase/server";

// Studio access is limited to the emails in ADMIN_EMAILS (comma-separated).
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const allow = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return allow.includes(email.toLowerCase());
}

// Returns the signed-in admin user, or null if not signed in / not an admin.
export async function getAdminUser(): Promise<{ id: string; email: string } | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user && isAdminEmail(user.email)) {
      return { id: user.id, email: user.email! };
    }
  } catch {
    // no session
  }
  return null;
}
