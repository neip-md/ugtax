import "./globals.css";

/**
 * Pass-through root layout.
 *
 * It renders no <html>/<body> of its own: this segment sits above [locale] and
 * therefore cannot know the language. The shell is rendered by the layouts that
 * do know it (app/[locale]/layout.tsx and app/(legal)/layout.tsx) via
 * <HtmlShell lang=... /> in app/shell.tsx.
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
