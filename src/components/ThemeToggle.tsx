"use client";

import { useEffect, useSyncExternalStore } from "react";

type Pref = "light" | "dark" | "system";
const OPTIONS: { value: Pref; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
];

function readPref(): Pref {
  try {
    const p = localStorage.getItem("theme");
    return p === "light" || p === "dark" ? p : "system";
  } catch {
    return "system";
  }
}

function apply(pref: Pref) {
  const dark = pref === "dark" || (pref === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

// The saved choice lives in localStorage; this tiny store lets every toggle on the page re-render on change.
const listeners = new Set<() => void>();
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export default function ThemeToggle() {
  // The server can't see localStorage, so it renders "system"; the browser reads the real choice.
  const pref = useSyncExternalStore(subscribe, readPref, () => "system" as Pref);

  // In System mode, follow the OS when it switches between light and dark.
  useEffect(() => {
    if (pref !== "system") return;
    const media = matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => apply("system");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [pref]);

  function choose(next: Pref) {
    try {
      localStorage.setItem("theme", next);
    } catch {
      // Private windows can block storage; the page still switches for this visit.
    }
    apply(next);
    listeners.forEach((l) => l());
  }

  return (
    <div role="radiogroup" aria-label="Theme" className="flex rounded-full border border-line bg-panel p-0.5">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={pref === o.value}
          onClick={() => choose(o.value)}
          className={`rounded-full px-3 py-1 text-xs font-bold transition ${
            pref === o.value ? "bg-accent-bg text-accent-fg" : "text-muted hover:text-fg"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
