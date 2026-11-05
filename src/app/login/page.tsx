import GoogleButton from "./GoogleButton";
import ThemeToggle from "@/components/ThemeToggle";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { error } = await searchParams;
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-4">
      <div className="panel flex w-full max-w-sm flex-col gap-5 p-8 text-center">
        <p className="label text-danger!">Restricted · superadmins only</p>
        <h1 className="text-3xl font-bold">Prompt Chain Tool</h1>
        <p className="text-sm text-muted">
          Build, reorder and run the Earth Observatory&apos;s prompt chains. Sign in with Google; only accounts with{" "}
          <code className="font-mono text-accent">profiles.is_superadmin = true</code> get in.
        </p>
        {error && <p className="rounded border border-danger/40 px-3 py-2 text-sm text-danger">Sign-in failed. Try again.</p>}
        <GoogleButton />
      </div>
      <ThemeToggle />
    </main>
  );
}
