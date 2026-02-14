import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Space_Grotesk } from "next/font/google";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0c0d10",
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
  title: "Shield — Venue & Security Marketplace",
  description:
    "Connect venues with verified security personnel and agencies. Post needs, set availability, book with confidence.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Shield",
  },
  formatDetection: { telephone: false, email: false },
};

import { AuthProvider } from "@/components/auth/AuthProvider";
import { AppNav } from "@/components/auth/AppNav";
import { CallProvider } from "@/contexts/CallContext";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { IncomingCallModal, ActiveCallOverlay, DemoCallButton } from "@/components/calling";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${plusJakarta.variable}`}>
      <body className="min-h-screen font-sans">
        <ThemeProvider>
          <AuthProvider>
            <NotificationProvider>
              <CallProvider>
                <AppNav />
                <main className="pt-16">{children}</main>
                {/* Global call overlays */}
                <IncomingCallModal />
                <ActiveCallOverlay />
                {/* Demo call button for testing */}
                <DemoCallButton />
              </CallProvider>
            </NotificationProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
