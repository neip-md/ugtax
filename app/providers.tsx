"use client";

import { ThemeProvider } from "@/lib/theme";
import { ReactNode } from "react";

export function Providers({
  children,
  initialTheme,
}: {
  children: ReactNode;
  // Read from the request cookie by the (server) layout, so the first client
  // render matches the server HTML instead of failing hydration.
  initialTheme?: "dark" | "light";
}) {
  return <ThemeProvider initialTheme={initialTheme}>{children}</ThemeProvider>;
}
