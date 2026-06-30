import type { Metadata } from "next";
import { Figtree, Geist_Mono } from "next/font/google";
import { IntlProvider } from "@/components/i18n/intl-provider";
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import "./globals.css";
import "./themes.css";
import "./transitions.css";

const figtree = Figtree({ subsets: ["latin"], variable: "--font-sans" });
const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  title: "G3",
  description: "S3-compatible storage backed by Google Drive.",
};

// Applied before first paint to avoid a flash of the wrong theme/locale. The
// static export has no per-user SSR, so these are read from cookies on the
// client. Defaults match the schema (modern-minimal / smooth / ru).
const FOUC_INIT = `(function(){try{var c=document.documentElement;function g(n){var m=document.cookie.match('(?:^|; )'+n+'=([^;]*)');return m&&decodeURIComponent(m[1]);}c.classList.add('theme-'+(g('ribbon_theme')||'modern-minimal'));c.classList.add('motion-'+(g('ribbon_motion')||'smooth'));c.lang=g('ribbon_locale')||'ru';}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="ru"
      className={cn("dark h-full", figtree.variable, geistMono.variable)}
      suppressHydrationWarning
    >
      <head>
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: pre-paint theme/locale init */}
        <script dangerouslySetInnerHTML={{ __html: FOUC_INIT }} />
      </head>
      <body className="min-h-full bg-background font-sans text-foreground antialiased">
        <IntlProvider>{children}</IntlProvider>
        <Toaster position="top-right" />
      </body>
    </html>
  );
}
