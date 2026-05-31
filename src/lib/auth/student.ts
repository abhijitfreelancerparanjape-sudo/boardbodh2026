// Resolves the current student id.
//
// Production: the authenticated Supabase user (real session). Until a login UI
// exists, NON-production falls back to a stable demo student created via the
// admin API, so the timed attempt flow can be exercised end to end. Production
// never uses the fallback: no session => no student.

import "server-only";
import { createClient } from "@/lib/supabase/server";

const DEMO_EMAIL = "demo.student@boardbodh.test";
let demoIdCache: string | null = null;

export async function getStudentId(): Promise<string | null> {
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    if (data.user) return data.user.id;
  } catch {
    // no session
  }
  if (process.env.NODE_ENV !== "production") {
    return ensureDemoStudent();
  }
  return null;
}

async function ensureDemoStudent(): Promise<string | null> {
  if (demoIdCache) return demoIdCache;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  const headers = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };

  const list = await fetch(`${url}/auth/v1/admin/users?per_page=200`, { headers })
    .then((r) => r.json())
    .catch(() => ({ users: [] }));
  const found = (list.users ?? []).find((u: { email?: string }) => u.email === DEMO_EMAIL);
  if (found) return (demoIdCache = found.id);

  const created = await fetch(`${url}/auth/v1/admin/users`, {
    method: "POST",
    headers,
    body: JSON.stringify({ email: DEMO_EMAIL, password: "demo-password-123", email_confirm: true }),
  })
    .then((r) => r.json())
    .catch(() => null);
  return created?.id ? (demoIdCache = created.id) : null;
}
