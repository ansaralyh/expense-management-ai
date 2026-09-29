import type { Metadata } from "next";
import "./globals.css";
import AppProviders from "../components/providers/AppProviders";

export const metadata: Metadata = {
  title: "SmartFin AI — Personal Finance Management",
  description: "Professional financial management, expense forecasting, anomaly detection, and health scoring.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased bg-slate-950 text-slate-100 min-h-screen font-sans text-left">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
