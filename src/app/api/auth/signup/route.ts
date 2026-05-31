import { NextResponse } from "next/server";

// Creates a student account, pre-confirmed via the admin API so no email
// confirmation step is needed (Phase 0). The client then signs in normally.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (!email || password.length < 6) {
    return NextResponse.json(
      { error: "Enter an email and a password of at least 6 characters." },
      { status: 400 }
    );
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return NextResponse.json({ error: "Auth is not configured." }, { status: 500 });
  }

  const res = await fetch(`${url}/auth/v1/admin/users`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, email_confirm: true }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = json?.msg || json?.message || "Could not create the account.";
    // Surface the common "already registered" case clearly.
    return NextResponse.json({ error: msg }, { status: res.status === 422 ? 409 : 400 });
  }
  return NextResponse.json({ ok: true });
}
