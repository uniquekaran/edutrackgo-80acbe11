import { useEffect } from "react";

/**
 * Global dark theme is enforced. This component is intentionally a no-op
 * so existing imports keep working without rendering a toggle.
 */
export function ThemeToggle(_props?: { variant?: "ghost" | "onPrimary" }) {
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.classList.add("dark");
    try {
      localStorage.setItem("edutrack:theme", "dark");
    } catch {
      /* ignore */
    }
  }, []);
  return null;
}
