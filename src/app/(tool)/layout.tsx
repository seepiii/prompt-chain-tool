import Link from "next/link";
import { requireAdmin } from "@/lib/supabase-server";
import ThemeToggle from "@/components/ThemeToggle";
import { signOut } from "../actions";

// Every page in this group is superadmin-only (the proxy checks too).
export default async function ToolLayout({ children }: LayoutProps<"/">) {
  const { profile } = await requireAdmin();
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 sm:px-8">
      <header className="flex flex-col gap-4 border-b border-line pb-5 sm:flex-row sm:items-center sm:justify-between">
        <Link href="/" className="flex flex-col gap-1">
          <p className="label text-accent!">● Superadmin · Earth Observatory</p>
          <h1 className="text-2xl font-bold">Prompt Chain Tool</h1>
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <nav className="flex gap-1 text-sm font-bold">
            <Link href="/" className="rounded-full px-3 py-1 text-muted hover:text-fg">Chains</Link>
            <Link href="/media" className="rounded-full px-3 py-1 text-muted hover:text-fg">Media</Link>
          </nav>
          <ThemeToggle />
          <span className="hidden font-mono text-xs text-muted md:inline">{profile.email}</span>
          <form action={signOut}>
            <button className="btn text-xs">Sign out</button>
          </form>
        </div>
      </header>
      {children}
    </div>
  );
}
