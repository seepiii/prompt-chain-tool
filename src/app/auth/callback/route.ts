import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase-server";

// Google → Supabase → here. Swap the one-time code for a session cookie;
// the proxy then decides whether this account is a superadmin.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  if (code) {
    const supabase = await createSupabaseServer();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}/`);
  }
  return NextResponse.redirect(`${origin}/login?error=auth`);
}
