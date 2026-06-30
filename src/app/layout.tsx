import type { Metadata } from "next";
import { Figtree, Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { THEME_COOKIE } from "@/lib/auth-constants";
import { MOTION_COOKIE, motionClass } from "@/lib/motion";
import { themeClass } from "@/lib/themes";
import { cn } from "@/lib/utils";
import { NavProgress } from "@/providers/nav-progress";
import { SmoothScroll } from "@/providers/smooth-scroll";
import "./globals.css";
import "./themes.css";
import "./transitions.css";

const figtree = Figtree({ subsets: ["latin"], variable: "--font-sans" });
const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  title: "Ribbon",
  description: "Admin dashboard with role-based access control.",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const cookieStore = await cookies();
  const themeCookie = cookieStore.get(THEME_COOKIE)?.value;
  const motionCookie = cookieStore.get(MOTION_COOKIE)?.value;
  const locale = await getLocale();

  return (
    <html
      lang={locale}
      className={cn(
        "dark h-full",
        themeClass(themeCookie ?? ""),
        motionClass(motionCookie ?? ""),
        figtree.variable,
        geistMono.variable,
      )}
      suppressHydrationWarning
    >
      {process.env.NODE_ENV !== "production" ? (
        <head>
          {/* tweakcn live theme preview — dev only */}
          <script
            async
            crossOrigin="anonymous"
            src="https://tweakcn.com/live-preview.min.js"
          />
        </head>
      ) : null}
      <body className="min-h-full bg-background font-sans text-foreground antialiased">
        <NextIntlClientProvider>
          <SmoothScroll>
            <NavProgress>
              <TooltipProvider delayDuration={300}>{children}</TooltipProvider>
            </NavProgress>
          </SmoothScroll>
        </NextIntlClientProvider>
        <Toaster position="top-right" />
      </body>
    </html>
  );
}
