import { createSupabaseServer } from "@/lib/supabase-server";
import { signOut } from "../actions";

export default async function DeniedPage() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="panel flex w-full max-w-md flex-col gap-4 p-8 text-center">
        <p className="label text-danger!">Access denied</p>
        <h1 className="text-2xl font-bold">Superadmins only</h1>
        <p className="text-sm text-muted">
          {user ? <>You&apos;re signed in as <strong className="text-fg">{user.email}</strong>, but </> : "This "}
          account isn&apos;t a superadmin, so the prompt chain tool stays locked.
        </p>
        {user && (
          <form action={signOut}>
            <button className="btn">Sign out</button>
          </form>
        )}
      </div>
    </main>
  );
}
