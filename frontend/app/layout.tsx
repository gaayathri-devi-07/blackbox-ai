import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/components/providers/auth-provider";
import { ToastProvider } from "@/components/ui/toast";
import { SITE_URL } from "@/lib/site";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"], display: "swap" });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"], display: "swap" });
const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Blackbox — Interview preparation for AI and systems engineers",
    template: "%s · Blackbox",
  },
  description:
    "Track-calibrated mock interviews, moderated group discussions and a curated practice bank for AI engineers, ML engineers and systems architects.",
  applicationName: "Blackbox",
  metadataBase: new URL(SITE_URL),
  openGraph: {
    type: "website",
    siteName: "Blackbox",
    title: "Blackbox — The interview is a system. Train for it like one.",
    description:
      "Mock interviews, moderated group discussions and a curated practice bank for AI engineers, ML researchers and systems architects.",
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0f1f19" },
    { media: "(prefers-color-scheme: light)", color: "#f7f8f3" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} ${instrumentSerif.variable}`}>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem storageKey="bbx-theme-v2" disableTransitionOnChange>
          <ToastProvider>
            <AuthProvider>{children}</AuthProvider>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
