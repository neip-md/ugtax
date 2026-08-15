"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";

type Theme = "dark" | "light";

const ThemeContext = createContext<{ theme: Theme; toggle: () => void }>({
  theme: "dark",
  toggle: () => {},
});

function readInitialTheme(serverTheme?: Theme): Theme {
  // On the server, use the theme the layout read from the request cookie.
  // Returning a hardcoded "dark" here used to make the server and client
  // disagree for any user on light mode, which failed hydration and threw away
  // the server-rendered HTML on every page load.
  if (typeof document === "undefined") return serverTheme ?? "dark";
  const stored = document.cookie
    .split("; ")
    .find((c) => c.startsWith("theme="))
    ?.split("=")[1] as Theme | undefined;
  if (stored === "light" || stored === "dark") return stored;
  // No cookie yet: trust the server's value if it had one, otherwise fall back
  // to the OS preference. Reading matchMedia during the first render would
  // disagree with the server HTML, so it stays consistent with serverTheme.
  if (serverTheme) return serverTheme;
  if (typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: light)").matches) {
    return "light";
  }
  return "dark";
}

export function ThemeProvider({
  children,
  initialTheme,
}: {
  children: ReactNode;
  initialTheme?: Theme;
}) {
  const [theme, setTheme] = useState<Theme>(() => readInitialTheme(initialTheme));

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
      root.classList.remove("light");
    } else {
      root.classList.remove("dark");
      root.classList.add("light");
    }
    document.cookie = `theme=${theme};path=/;max-age=${60 * 60 * 24 * 365}`;
  }, [theme]);

  function toggle() {
    setTheme((t) => (t === "dark" ? "light" : "dark"));
  }

  return (
    <ThemeContext.Provider value={{ theme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
