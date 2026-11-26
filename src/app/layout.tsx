import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { RegisterSW } from "@/components/pwa/register-sw";
import { THEME_SCRIPT } from "@/components/theme/theme";
import { getSetting } from "@/server/admin";
import { appIcons, getBranding } from "@/server/branding";

const inter = Inter({ variable: "--font-sans", subsets: ["latin"] });

/** Tab icon, iPhone home-screen icon and app name follow the company logo and name from System settings. */
export async function generateMetadata(): Promise<Metadata> {
  const [company, branding] = await Promise.all([getSetting("company"), getBranding()]);
  const icons = appIcons(branding);
  const name = company.name || "Feed";
  return {
    title: `${name} Feedback`,
    description: "Raise concerns and share ideas anonymously, without logging in.",
    applicationName: name,
    appleWebApp: { capable: true, title: name, statusBarStyle: "default" },
    icons: { icon: [{ url: icons.i32, sizes: icons.custom ? "32x32" : "any" }], apple: [{ url: icons.i180, sizes: "180x180" }] },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#18181b" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    // suppressHydrationWarning: the theme script sets class="dark" before React hydrates.
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      {/* suppressHydrationWarning: browser extensions (e.g. ColorZilla) inject attributes on <body>. Only affects this element's own attributes. */}
      <body className={`${inter.variable} font-sans antialiased`} suppressHydrationWarning>
        {children}
        <Toaster />
        <RegisterSW />
      </body>
    </html>
  );
}
