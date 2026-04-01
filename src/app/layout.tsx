import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Space_Grotesk } from "next/font/google";
import dynamic from "next/dynamic";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#080a0f",
};

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Shield HQ — Venue & Security Marketplace",
  description:
    "Connect venues with verified security personnel and agencies. Post needs, set availability, book with confidence.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Shield HQ",
  },
  formatDetection: { telephone: false, email: false },
};

import { AuthProvider } from "@/components/auth/AuthProvider";
import { AppNav } from "@/components/auth/AppNav";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { ToastProvider } from "@/components/ui/Toast";

const CallShell = dynamic(
  () => import("@/components/calling/CallShell").then((m) => m.CallShell)
);

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${plusJakarta.variable}`}>
      <body className="min-h-screen font-sans">
        <ThemeProvider>
          <ToastProvider>
            <AuthProvider>
              <NotificationProvider>
                <CallShell>
                  <AppNav />
                  <main className="pt-16">{children}</main>
                </CallShell>
              </NotificationProvider>
            </AuthProvider>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
