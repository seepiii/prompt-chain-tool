import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

// Per-request client that reads/writes the auth session cookies.
export async function createSupabaseServer() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Server Components can't set cookies; the proxy refreshes them instead.
          }
        },
      },
    },
  );
}

/**
 * The authoritative gate for every admin page and action: signed in AND profiles.is_superadmin.
 * (The proxy checks the same thing first; this runs again next to the data.)
 */
export async function requireAdmin() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, last_name, email, avatar_url, is_superadmin")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.is_superadmin) redirect("/denied");

  return { supabase, user, profile };
}
