import type { Metadata } from "next";
import { Lato } from "next/font/google";
import "./globals.css";

const lato = Lato({ variable: "--font-lato", subsets: ["latin"], weight: ["400", "700", "900"] });

export const metadata: Metadata = {
  title: "Prompt Chain Tool",
  description: "Build, reorder and run the Earth Observatory's prompt chains",
  robots: { index: false, follow: false },
};

// Runs before first paint so the saved theme (or the system's) shows without a flash.
// Kept in sync with ThemeToggle, which writes the same localStorage key.
const THEME_SCRIPT = `(function(){try{var p=localStorage.getItem("theme")||"system";var d=p==="dark"||(p==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d);}catch(e){}})();`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // The theme script changes <html>'s class before React hydrates.
    <html lang="en" className={`${lato.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-full font-sans">{children}</body>
    </html>
  );
}
